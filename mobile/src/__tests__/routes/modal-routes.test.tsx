/**
 * Smoke tests for modal/screen routes.
 * Covers compose, messages, drafts, scheduled, analytics, lists, feeds, post detail.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

// Helper to create mock components inside jest.mock factories
function mockComponent(testID: string) {
  const RN = require('react-native');
  const R = require('react');
  return (props: any) => R.createElement(RN.View, { testID }, R.createElement(RN.Text, null, testID));
}

// --- Mock screen components ---
jest.mock('../../screens/compose/ComposeScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ComposeScreen: () => R.createElement(RN.View, { testID: 'mock-ComposeScreen' }, R.createElement(RN.Text, null, 'ComposeScreen')) };
});

jest.mock('../../screens/compose/ComposeScreenNative', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ComposeScreenNative: () => R.createElement(RN.View, { testID: 'mock-ComposeScreenNative' }, R.createElement(RN.Text, null, 'ComposeScreenNative')) };
});

jest.mock('../../screens/profile/MessagesScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { MessagesScreen: () => R.createElement(RN.View, { testID: 'mock-MessagesScreen' }, R.createElement(RN.Text, null, 'MessagesScreen')) };
});

jest.mock('../../screens/compose/DraftsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  const mockComp = () => R.createElement(RN.View, { testID: 'mock-DraftsScreen' }, R.createElement(RN.Text, null, 'DraftsScreen'));
  return { DraftsScreen: mockComp, __esModule: true, default: mockComp };
});

jest.mock('../../screens/scheduled/ScheduledPostsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ScheduledPostsScreen: () => R.createElement(RN.View, { testID: 'mock-ScheduledPostsScreen' }, R.createElement(RN.Text, null, 'ScheduledPostsScreen')) };
});

jest.mock('../../screens/analytics/AnalyticsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { AnalyticsScreen: () => R.createElement(RN.View, { testID: 'mock-AnalyticsScreen' }, R.createElement(RN.Text, null, 'AnalyticsScreen')) };
});

jest.mock('../../screens/lists/ListsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ListsScreen: () => R.createElement(RN.View, { testID: 'mock-ListsScreen' }, R.createElement(RN.Text, null, 'ListsScreen')) };
});

jest.mock('../../screens/lists/CreateListScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { CreateListScreen: () => R.createElement(RN.View, { testID: 'mock-CreateListScreen' }, R.createElement(RN.Text, null, 'CreateListScreen')) };
});

jest.mock('../../screens/lists/ListDetailScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ListDetailScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-ListDetailScreen' }, R.createElement(RN.Text, null, 'ListDetailScreen:' + props.listUri)) };
});

jest.mock('../../screens/feeds/FeedDiscoveryScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { FeedDiscoveryScreen: () => R.createElement(RN.View, { testID: 'mock-FeedDiscoveryScreen' }, R.createElement(RN.Text, null, 'FeedDiscoveryScreen')) };
});

jest.mock('../../screens/feeds/FeedCreationScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { FeedCreationScreen: () => R.createElement(RN.View, { testID: 'mock-FeedCreationScreen' }, R.createElement(RN.Text, null, 'FeedCreationScreen')) };
});

jest.mock('../../screens/feeds/SavedFeedsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { SavedFeedsScreen: () => R.createElement(RN.View, { testID: 'mock-SavedFeedsScreen' }, R.createElement(RN.Text, null, 'SavedFeedsScreen')) };
});

jest.mock('../../screens/shared/LikesScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { LikesScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-LikesScreen' }, R.createElement(RN.Text, null, 'LikesScreen:' + props.postUri)) };
});

jest.mock('../../screens/shared/QuotesScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { QuotesScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-QuotesScreen' }, R.createElement(RN.Text, null, 'QuotesScreen:' + props.postUri)) };
});

jest.mock('../../screens/shared/RepostsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { RepostsScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-RepostsScreen' }, R.createElement(RN.Text, null, 'RepostsScreen:' + props.postUri)) };
});

jest.mock('../../screens/profile/FollowersScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { FollowersScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-FollowersScreen' }, R.createElement(RN.Text, null, 'FollowersScreen:' + props.actor)) };
});

jest.mock('../../screens/profile/FollowingScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { FollowingScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-FollowingScreen' }, R.createElement(RN.Text, null, 'FollowingScreen:' + props.actor)) };
});

jest.mock('../../components/ErrorState', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ErrorState: ({ message }: { message: string }) => R.createElement(RN.View, { testID: 'mock-ErrorState' }, R.createElement(RN.Text, null, message)) };
});

// Mock hooks used by quotes route
jest.mock('../../hooks/api/usePosts', () => ({
  useLikePost: () => ({ mutate: jest.fn() }),
  useUnlikePost: () => ({ mutate: jest.fn() }),
  useRepost: () => ({ mutate: jest.fn() }),
  useDeleteRepost: () => ({ mutate: jest.fn() }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ account: { did: 'did:plc:test', handle: 'test.bsky.social' } }),
}));

jest.mock('../../hooks/api/useBookmarks', () => ({
  useBookmarks: () => ({ isBookmarked: jest.fn(() => false), toggleBookmark: jest.fn() }),
}));

jest.mock('../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../hooks/useRequiredParam', () => ({
  useRequiredParam: (paramName: string) => {
    const { useLocalSearchParams: mockGetParams } = require('expo-router');
    const params = mockGetParams();
    const value = params[paramName] as string | undefined;
    return { value: value || null, isValid: !!value };
  },
}));

// Import routes
import ComposeRoute from '../../../app/(app)/compose';
import MessagesRoute from '../../../app/(app)/messages';
import DraftsRoute from '../../../app/(app)/drafts';
import ScheduledRoute from '../../../app/(app)/scheduled';
import AnalyticsRoute from '../../../app/(app)/analytics';
import ListsRoute from '../../../app/(app)/lists';
import CreateListRoute from '../../../app/(app)/lists/create';
import ListMembersRoute from '../../../app/(app)/lists/[uri]/members';
import FeedDiscoveryRoute from '../../../app/(app)/feeds/discover';
import FeedCreationRoute from '../../../app/(app)/feeds/create';
import SavedFeedsRoute from '../../../app/(app)/feeds/saved';
import FeedRoute from '../../../app/(app)/feed/[uri]';
import PostLikesRoute from '../../../app/(app)/post/[uri]/likes';
import PostQuotesRoute from '../../../app/(app)/post/[uri]/quotes';
import PostRepostsRoute from '../../../app/(app)/post/[uri]/reposts';
import FollowersRoute from '../../../app/(app)/(tabs)/(profile)/followers/[actor]';
import FollowingRoute from '../../../app/(app)/(tabs)/(profile)/following/[actor]';

describe('Modal/Screen Routes - Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  describe('Compose', () => {
    it('renders ComposeRoute without crash', () => {
      const { toJSON } = render(<ComposeRoute />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Messages', () => {
    it('renders MessagesRoute without crash', () => {
      const { getByTestId } = render(<MessagesRoute />);
      expect(getByTestId('mock-MessagesScreen')).toBeTruthy();
    });
  });

  describe('Drafts', () => {
    it('renders DraftsRoute without crash', () => {
      const { getByTestId } = render(<DraftsRoute />);
      expect(getByTestId('mock-DraftsScreen')).toBeTruthy();
    });
  });

  describe('Scheduled', () => {
    it('renders ScheduledRoute without crash', () => {
      const { getByTestId } = render(<ScheduledRoute />);
      expect(getByTestId('mock-ScheduledPostsScreen')).toBeTruthy();
    });
  });

  describe('Analytics', () => {
    it('renders AnalyticsRoute without crash', () => {
      const { getByTestId } = render(<AnalyticsRoute />);
      expect(getByTestId('mock-AnalyticsScreen')).toBeTruthy();
    });
  });

  describe('Lists', () => {
    it('renders ListsRoute without crash', () => {
      const { getByTestId } = render(<ListsRoute />);
      expect(getByTestId('mock-ListsScreen')).toBeTruthy();
    });

    it('renders CreateListRoute without crash', () => {
      const { getByTestId } = render(<CreateListRoute />);
      expect(getByTestId('mock-CreateListScreen')).toBeTruthy();
    });

    it('renders ListMembersRoute with valid URI', () => {
      mockUseLocalSearchParams.mockReturnValue({ uri: 'at%3A%2F%2Fdid%3Aplc%3Atest%2Fapp.bsky.graph.list%2Fabc' });
      const { getByTestId } = render(<ListMembersRoute />);
      expect(getByTestId('mock-ListDetailScreen')).toBeTruthy();
    });

    it('renders null for ListMembersRoute with missing URI', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { toJSON } = render(<ListMembersRoute />);
      expect(toJSON()).toBeNull();
    });
  });

  describe('Feeds', () => {
    it('renders FeedDiscoveryRoute without crash', () => {
      const { getByTestId } = render(<FeedDiscoveryRoute />);
      expect(getByTestId('mock-FeedDiscoveryScreen')).toBeTruthy();
    });

    it('renders FeedCreationRoute without crash', () => {
      const { getByTestId } = render(<FeedCreationRoute />);
      expect(getByTestId('mock-FeedCreationScreen')).toBeTruthy();
    });

    it('renders SavedFeedsRoute without crash', () => {
      const { getByTestId } = render(<SavedFeedsRoute />);
      expect(getByTestId('mock-SavedFeedsScreen')).toBeTruthy();
    });
  });

  describe('Feed detail', () => {
    it('renders FeedRoute with valid URI', () => {
      mockUseLocalSearchParams.mockReturnValue({ uri: 'at://did:plc:test/app.bsky.feed.generator/my-feed' });
      const { getByText } = render(<FeedRoute />);
      expect(getByText('Loading feed...')).toBeTruthy();
    });

    it('renders error state for FeedRoute with missing URI', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<FeedRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing feed URI')).toBeTruthy();
    });
  });

  describe('Post detail', () => {
    it('renders PostLikesRoute with valid URI', () => {
      mockUseLocalSearchParams.mockReturnValue({ uri: 'at%3A%2F%2Fdid%3Aplc%3Atest%2Fapp.bsky.feed.post%2Fabc' });
      const { getByTestId } = render(<PostLikesRoute />);
      expect(getByTestId('mock-LikesScreen')).toBeTruthy();
    });

    it('renders error state for PostLikesRoute with missing URI', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId } = render(<PostLikesRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
    });

    it('renders PostQuotesRoute with valid URI', () => {
      mockUseLocalSearchParams.mockReturnValue({ uri: 'at%3A%2F%2Fdid%3Aplc%3Atest%2Fapp.bsky.feed.post%2Fabc' });
      const { getByTestId } = render(<PostQuotesRoute />);
      expect(getByTestId('mock-QuotesScreen')).toBeTruthy();
    });

    it('renders error state for PostQuotesRoute with missing URI', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId } = render(<PostQuotesRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
    });

    it('renders PostRepostsRoute with valid URI', () => {
      mockUseLocalSearchParams.mockReturnValue({ uri: 'at%3A%2F%2Fdid%3Aplc%3Atest%2Fapp.bsky.feed.post%2Fabc' });
      const { getByTestId } = render(<PostRepostsRoute />);
      expect(getByTestId('mock-RepostsScreen')).toBeTruthy();
    });

    it('renders error state for PostRepostsRoute with missing URI', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId } = render(<PostRepostsRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
    });
  });

  describe('Followers / Following', () => {
    it('renders FollowersRoute with valid actor', () => {
      mockUseLocalSearchParams.mockReturnValue({ actor: 'alice.bsky.social' });
      const { getByTestId } = render(<FollowersRoute />);
      expect(getByTestId('mock-FollowersScreen')).toBeTruthy();
    });

    it('renders error state for FollowersRoute with missing actor', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<FollowersRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing actor parameter')).toBeTruthy();
    });

    it('renders FollowingRoute with valid actor', () => {
      mockUseLocalSearchParams.mockReturnValue({ actor: 'alice.bsky.social' });
      const { getByTestId } = render(<FollowingRoute />);
      expect(getByTestId('mock-FollowingScreen')).toBeTruthy();
    });

    it('renders error state for FollowingRoute with missing actor', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<FollowingRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing actor parameter')).toBeTruthy();
    });
  });
});
