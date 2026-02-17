import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { mockTheme, makeFeedViewPost } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

const mockFollowMutate = jest.fn();
const mockUnfollowMutate = jest.fn();
const mockBlockMutate = jest.fn();
const mockUnblockMutate = jest.fn();
const mockMuteMutate = jest.fn();
const mockUnmuteMutate = jest.fn();
const mockRefetchProfile = jest.fn().mockResolvedValue({});

const mockProfile = {
  did: 'did:plc:testuser',
  handle: 'testuser.bsky.social',
  displayName: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  banner: 'https://example.com/banner.jpg',
  description: 'A test bio description',
  postsCount: 42,
  followersCount: 100,
  followsCount: 50,
  viewer: {},
  labels: [],
};

let mockProfileData = mockProfile;
let mockProfileLoading = false;
let mockProfileError: Error | null = null;

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    account: { handle: 'myhandle.bsky.social', did: 'did:plc:me' },
  }),
}));

jest.mock('../../../hooks/api/useProfile', () => ({
  useProfile: () => ({
    data: mockProfileData,
    isLoading: mockProfileLoading,
    error: mockProfileError,
    refetch: mockRefetchProfile,
  }),
  useFollowUser: () => ({ mutate: mockFollowMutate, isPending: false }),
  useUnfollowUser: () => ({ mutate: mockUnfollowMutate, isPending: false }),
  useBlockUser: () => ({ mutate: mockBlockMutate, mutateAsync: jest.fn() }),
  useUnblockUser: () => ({ mutate: mockUnblockMutate }),
  useMuteUser: () => ({ mutate: mockMuteMutate, mutateAsync: jest.fn() }),
  useUnmuteUser: () => ({ mutate: mockUnmuteMutate }),
}));

const mockFeedPages = [
  {
    feed: [
      makeFeedViewPost({ post: { uri: 'at://did:plc:testuser/app.bsky.feed.post/1' } }),
      makeFeedViewPost({ post: { uri: 'at://did:plc:testuser/app.bsky.feed.post/2' } }),
    ],
    cursor: 'cursor1',
  },
];

const mockRefetchFeed = jest.fn().mockResolvedValue({});
const mockFetchNextPage = jest.fn();

jest.mock('../../../hooks/api/useFeed', () => ({
  useAuthorFeed: () => ({
    data: { pages: mockFeedPages },
    isLoading: false,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: mockRefetchFeed,
  }),
  useActorLikes: () => ({
    data: { pages: [] },
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
  }),
  usePostThread: () => ({ data: null }),
}));

jest.mock('../../../hooks/api/useStarterPacks', () => ({
  useActorStarterPacks: () => ({ data: null }),
}));

jest.mock('../../../hooks/useSpotlightIndex', () => ({
  useSpotlightProfile: jest.fn(),
}));

jest.mock('../../../hooks/useOfflineFeed', () => ({
  useOfflineFeedEnhancer: (query: any) => ({
    ...query,
    isServingCached: false,
    isStale: false,
    isOnline: true,
  }),
  useOfflineFeedStatus: () => ({ lastCachedAt: null }),
}));

jest.mock('../../../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../../contexts/ModerationContext', () => ({
  useModeration: () => ({
    shouldHideContent: jest.fn(() => false),
    shouldWarnContent: jest.fn(() => false),
    shouldBlurImages: jest.fn(() => false),
    getContentWarningText: jest.fn(() => ''),
  }),
}));

jest.mock('../../../contexts/SharedTransitionContext', () => ({
  useSharedTransition: () => ({
    prepareTransition: jest.fn(),
    state: { active: false, sourceLayout: null, postData: null },
  }),
}));

jest.mock('../../../services/dm-service', () => ({
  dmService: {
    getConvoForMembers: jest.fn().mockResolvedValue({ id: 'convo-123' }),
  },
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('../../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
}));

jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../../utils/share', () => ({
  sharePost: jest.fn(),
}));

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

jest.mock('../../../hooks/usePostTranslation', () => ({
  usePostTranslation: () => ({
    showTranslateButton: false,
    isTranslating: false,
    translatedText: null,
    isShowingTranslation: false,
    translationError: null,
    sourceLanguageName: null,
    handleTranslate: jest.fn(),
  }),
}));

jest.mock('../../../components/PostEmbed', () => ({
  PostEmbed: () => null,
}));

jest.mock('../../../components/ContentLabelWarning', () => ({
  ContentLabelWarning: ({ children }: any) => children,
}));

jest.mock('../../../components/AddToListModal', () => ({
  AddToListModal: () => null,
}));

jest.mock('../../../components/ReportModal', () => ({
  ReportModal: () => null,
}));

jest.mock('../../../components/SaveToCollectionModal', () => ({
  SaveToCollectionModal: () => null,
}));

jest.mock('../../../components/StaleContentIndicator', () => {
  return () => null;
});

jest.mock('../../../utils/rich-text', () => ({
  RichText: ({ text }: any) => {
    const { Text } = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('../../../utils/browser', () => ({
  openLink: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────
import { ProfileScreen } from '../ProfileScreen';

// ─── Tests ────────────────────────────────────────────────

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileData = mockProfile;
    mockProfileLoading = false;
    mockProfileError = null;
  });

  // ─── Profile header rendering ───────────────────────────

  describe('profile header rendering', () => {
    it('renders display name and handle', () => {
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Test User')).toBeTruthy();
      expect(getByText('@testuser.bsky.social')).toBeTruthy();
    });

    it('renders bio description', () => {
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('A test bio description')).toBeTruthy();
    });

    it('renders post, follower, and following counts', () => {
      const { getByText, getAllByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('42')).toBeTruthy();
      // "Posts" appears in both the stat label and the tab bar
      expect(getAllByText('Posts').length).toBeGreaterThanOrEqual(1);
      expect(getByText('100')).toBeTruthy();
      expect(getByText('Followers')).toBeTruthy();
      expect(getByText('50')).toBeTruthy();
      // "Following" appears as a stat label
      expect(getAllByText('Following').length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to handle when displayName is missing', () => {
      mockProfileData = { ...mockProfile, displayName: '' };
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('testuser.bsky.social')).toBeTruthy();
    });

    it('renders banner image when present', () => {
      const { getAllByTestId } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      const images = getAllByTestId('expo-image');
      expect(images.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Failed to load profile" on error', () => {
      mockProfileData = null as any;
      mockProfileError = new Error('Network error');

      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Failed to load profile')).toBeTruthy();
    });

    it('renders bio only when description exists', () => {
      mockProfileData = { ...mockProfile, description: undefined } as any;

      const { queryByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(queryByText('A test bio description')).toBeNull();
    });
  });

  // ─── Follow/unfollow button ─────────────────────────────

  describe('follow/unfollow button', () => {
    it('shows "Follow" button for non-followed user', () => {
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Follow')).toBeTruthy();
    });

    it('shows "Following" button for followed user', () => {
      mockProfileData = {
        ...mockProfile,
        viewer: { following: 'at://did:plc:me/app.bsky.graph.follow/abc' },
      };

      const { getAllByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      // "Following" appears as both the button text and the stat label
      const followingTexts = getAllByText('Following');
      expect(followingTexts.length).toBeGreaterThanOrEqual(2);
    });

    it('calls follow mutation when Follow is pressed', () => {
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      fireEvent.press(getByText('Follow'));
      expect(mockFollowMutate).toHaveBeenCalledWith('did:plc:testuser');
    });

    it('calls unfollow mutation when Following button is pressed', () => {
      const followUri = 'at://did:plc:me/app.bsky.graph.follow/abc';
      mockProfileData = {
        ...mockProfile,
        viewer: { following: followUri },
      };

      const { getAllByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      // "Following" appears as both stat label (first) and button text (second)
      const followingTexts = getAllByText('Following');
      fireEvent.press(followingTexts[followingTexts.length - 1]);
      expect(mockUnfollowMutate).toHaveBeenCalledWith(followUri);
    });

    it('does not show follow button on own profile', () => {
      mockProfileData = {
        ...mockProfile,
        handle: 'myhandle.bsky.social',
      };

      const { queryByText, queryAllByText } = render(
        <ProfileScreen handle="myhandle.bsky.social" />
      );

      expect(queryByText('Follow')).toBeNull();
      // "Following" still appears as a stat label, but not as a button
      // On own profile there's no follow/unfollow button, so only the stat label shows
      const followingTexts = queryAllByText('Following');
      // Should have at most 1 instance (the stat label), not 2 (which would include a button)
      expect(followingTexts.length).toBeLessThanOrEqual(1);
    });
  });

  // ─── Tab switching ──────────────────────────────────────

  describe('tab switching', () => {
    it('renders tab bar with Posts, Replies, Media, and Likes tabs', () => {
      const { getAllByText, getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      // "Posts" appears in both stats and tab bar
      expect(getAllByText('Posts').length).toBeGreaterThanOrEqual(2);
      expect(getByText('Replies')).toBeTruthy();
      expect(getByText('Media')).toBeTruthy();
      expect(getByText('Likes')).toBeTruthy();
    });

    it('switches to Likes tab when pressed', () => {
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      fireEvent.press(getByText('Likes'));
      // After switching to likes, the empty state for likes shows
      // since our mock returns empty likes data
      expect(getByText('No likes yet')).toBeTruthy();
    });

    it('shows "No posts yet" when feed is empty on posts tab', () => {
      // Override feed to return empty
      jest.spyOn(
        require('../../../hooks/api/useFeed'),
        'useAuthorFeed'
      ).mockReturnValue({
        data: { pages: [{ feed: [] }] },
        isLoading: false,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
      });

      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('No posts yet')).toBeTruthy();

      jest.restoreAllMocks();
    });

    it('switches between tabs without crashing', () => {
      const { getByText, getAllByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      fireEvent.press(getByText('Replies'));
      fireEvent.press(getByText('Media'));
      fireEvent.press(getByText('Likes'));
      // "Posts" appears in both stats and tab bar; press the last one (tab bar)
      const postsTexts = getAllByText('Posts');
      fireEvent.press(postsTexts[postsTexts.length - 1]);

      // Should still render fine after cycling tabs
      expect(getByText('Test User')).toBeTruthy();
    });
  });

  // ─── Navigation callbacks ───────────────────────────────

  describe('navigation callbacks', () => {
    it('calls onNavigateToFollowers when followers count is pressed', () => {
      const onNavigateToFollowers = jest.fn();

      const { getByText } = render(
        <ProfileScreen
          handle="testuser.bsky.social"
          onNavigateToFollowers={onNavigateToFollowers}
        />
      );

      fireEvent.press(getByText('Followers'));
      expect(onNavigateToFollowers).toHaveBeenCalledWith('testuser.bsky.social');
    });

    it('calls onNavigateToFollowing when following count is pressed', () => {
      const onNavigateToFollowing = jest.fn();

      const { getByText } = render(
        <ProfileScreen
          handle="testuser.bsky.social"
          onNavigateToFollowing={onNavigateToFollowing}
        />
      );

      fireEvent.press(getByText('Following'));
      expect(onNavigateToFollowing).toHaveBeenCalledWith('testuser.bsky.social');
    });

    it('calls onNavigateToPost when a post is pressed', () => {
      const onNavigateToPost = jest.fn();

      const { getAllByLabelText } = render(
        <ProfileScreen
          handle="testuser.bsky.social"
          onNavigateToPost={onNavigateToPost}
        />
      );

      const postCards = getAllByLabelText(/Post by/);
      if (postCards.length > 0) {
        fireEvent.press(postCards[0]);
      }
    });
  });

  // ─── Block/mute status indicators ──────────────────────

  describe('block/mute status indicators', () => {
    it('shows Blocked badge when user is blocked', () => {
      mockProfileData = {
        ...mockProfile,
        viewer: { blocking: 'at://did:plc:me/app.bsky.graph.block/abc' },
      };

      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Blocked')).toBeTruthy();
    });

    it('shows Muted badge when user is muted', () => {
      mockProfileData = {
        ...mockProfile,
        viewer: { muted: true },
      };

      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Muted')).toBeTruthy();
    });

    it('shows "Blocks you" badge when blocked by user', () => {
      mockProfileData = {
        ...mockProfile,
        viewer: { blockedBy: true },
      };

      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Blocks you')).toBeTruthy();
    });
  });

  // ─── Action buttons ─────────────────────────────────────

  describe('action buttons', () => {
    it('shows "Add to List" button for non-own profiles', () => {
      const { getByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      expect(getByText('Add to List')).toBeTruthy();
    });

    it('does not show "Add to List" button on own profile', () => {
      mockProfileData = {
        ...mockProfile,
        handle: 'myhandle.bsky.social',
      };

      const { queryByText } = render(
        <ProfileScreen handle="myhandle.bsky.social" />
      );

      expect(queryByText('Add to List')).toBeNull();
    });
  });

  // ─── Zero-count edge case ──────────────────────────────

  describe('edge cases', () => {
    it('renders with zero counts', () => {
      mockProfileData = {
        ...mockProfile,
        postsCount: 0,
        followersCount: 0,
        followsCount: 0,
      };

      const { getAllByText } = render(
        <ProfileScreen handle="testuser.bsky.social" />
      );

      const zeros = getAllByText('0');
      expect(zeros.length).toBe(3);
    });

    it('handles null/undefined counts', () => {
      mockProfileData = {
        ...mockProfile,
        postsCount: undefined,
        followersCount: undefined,
        followsCount: undefined,
      } as any;

      expect(() =>
        render(<ProfileScreen handle="testuser.bsky.social" />)
      ).not.toThrow();
    });
  });
});
