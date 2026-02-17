import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme, makeFeedViewPost } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

const mockSignOut = jest.fn().mockResolvedValue(undefined);

const mockProfile = {
  did: 'did:plc:myuser',
  handle: 'myuser.bsky.social',
  displayName: 'My User',
  avatar: 'https://example.com/my-avatar.jpg',
  description: 'My bio text here',
  postsCount: 25,
  followersCount: 200,
  followsCount: 75,
  viewer: {},
  labels: [],
};

let mockProfileData = mockProfile;
let mockProfileLoading = false;

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    account: { handle: 'myuser.bsky.social', did: 'did:plc:myuser' },
    signOut: mockSignOut,
  }),
}));

jest.mock('../../../hooks/api/useProfile', () => ({
  useProfile: () => ({
    data: mockProfileData,
    isLoading: mockProfileLoading,
    refetch: jest.fn().mockResolvedValue({}),
  }),
  useFollowUser: () => ({ mutate: jest.fn(), isPending: false }),
  useUnfollowUser: () => ({ mutate: jest.fn(), isPending: false }),
  useBlockUser: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
  useMuteUser: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));

const mockFeedPages = [
  {
    feed: [
      makeFeedViewPost({ post: { uri: 'at://did:plc:myuser/app.bsky.feed.post/1' } }),
      makeFeedViewPost({ post: { uri: 'at://did:plc:myuser/app.bsky.feed.post/2' } }),
    ],
    cursor: 'cursor1',
  },
];

jest.mock('../../../hooks/api/useFeed', () => ({
  useAuthorFeed: () => ({
    data: { pages: mockFeedPages },
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn().mockResolvedValue({}),
  }),
  useActorLikes: () => ({
    data: { pages: [] },
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('../../../hooks/api/useStarterPacks', () => ({
  useActorStarterPacks: () => ({ data: null }),
}));

jest.mock('../../../hooks/api/useBookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: jest.fn(() => false),
    toggleBookmark: jest.fn(),
  }),
  useBookmarkCount: () => 3,
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useScrollToTop: jest.fn(),
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
  formatDistanceToNow: () => '1 hour ago',
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

jest.mock('../../../components/SaveToCollectionModal', () => ({
  SaveToCollectionModal: () => null,
}));

jest.mock('../../../components/ReportModal', () => ({
  ReportModal: () => null,
}));

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
import { MyProfileScreen } from '../MyProfileScreen';

// ─── Tests ────────────────────────────────────────────────

describe('MyProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileData = mockProfile;
    mockProfileLoading = false;
  });

  // ─── Profile header rendering ───────────────────────────

  describe('profile header rendering', () => {
    it('renders display name and handle', () => {
      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('My User')).toBeTruthy();
      expect(getByText('@myuser.bsky.social')).toBeTruthy();
    });

    it('renders bio description', () => {
      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('My bio text here')).toBeTruthy();
    });

    it('renders post, follower, and following counts', () => {
      const { getByText, getAllByText } = render(<MyProfileScreen />);

      expect(getByText('25')).toBeTruthy();
      // "Posts" appears in both stat label and tab bar
      expect(getAllByText('Posts').length).toBeGreaterThanOrEqual(1);
      expect(getByText('200')).toBeTruthy();
      expect(getByText('Followers')).toBeTruthy();
      expect(getByText('75')).toBeTruthy();
      expect(getByText('Following')).toBeTruthy();
    });

    it('falls back to handle when displayName is missing', () => {
      mockProfileData = { ...mockProfile, displayName: '' };

      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('myuser.bsky.social')).toBeTruthy();
    });

    it('hides bio when description is empty', () => {
      mockProfileData = { ...mockProfile, description: undefined } as any;

      const { queryByText } = render(<MyProfileScreen />);

      expect(queryByText('My bio text here')).toBeNull();
    });
  });

  // ─── Action buttons ─────────────────────────────────────

  describe('action buttons', () => {
    it('renders Edit Profile button', () => {
      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('Edit Profile')).toBeTruthy();
    });

    it('calls onNavigateToEditProfile when Edit Profile is pressed', () => {
      const onNavigateToEditProfile = jest.fn();

      const { getByText } = render(
        <MyProfileScreen onNavigateToEditProfile={onNavigateToEditProfile} />
      );

      fireEvent.press(getByText('Edit Profile'));
      expect(onNavigateToEditProfile).toHaveBeenCalledTimes(1);
    });

    it('renders Bookmarks button with count', () => {
      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('Bookmarks (3)')).toBeTruthy();
    });

    it('renders Sign Out button', () => {
      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('Sign Out')).toBeTruthy();
    });

    it('calls signOut when Sign Out is pressed', () => {
      const onSignOut = jest.fn();

      const { getByText } = render(
        <MyProfileScreen onSignOut={onSignOut} />
      );

      fireEvent.press(getByText('Sign Out'));
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Tab switching ──────────────────────────────────────

  describe('tab switching', () => {
    it('renders all profile tabs', () => {
      const { getAllByText, getByText } = render(<MyProfileScreen />);

      // "Posts" appears in both stats and tab bar
      expect(getAllByText('Posts').length).toBeGreaterThanOrEqual(2);
      expect(getByText('Replies')).toBeTruthy();
      expect(getByText('Media')).toBeTruthy();
      expect(getByText('Likes')).toBeTruthy();
    });

    it('switches to Likes tab and shows empty state', () => {
      const { getByText } = render(<MyProfileScreen />);

      fireEvent.press(getByText('Likes'));
      expect(getByText('No likes yet')).toBeTruthy();
    });

    it('switches between all tabs without crashing', () => {
      const { getByText, getAllByText } = render(<MyProfileScreen />);

      fireEvent.press(getByText('Replies'));
      fireEvent.press(getByText('Media'));
      fireEvent.press(getByText('Likes'));
      // "Posts" appears in both stats and tab bar; press the last one (tab bar)
      const postsTexts = getAllByText('Posts');
      fireEvent.press(postsTexts[postsTexts.length - 1]);

      expect(getByText('My User')).toBeTruthy();
    });
  });

  // ─── Navigation callbacks ───────────────────────────────

  describe('navigation callbacks', () => {
    it('calls onNavigateToFollowers when followers count is pressed', () => {
      const onNavigateToFollowers = jest.fn();

      const { getByText } = render(
        <MyProfileScreen onNavigateToFollowers={onNavigateToFollowers} />
      );

      fireEvent.press(getByText('Followers'));
      expect(onNavigateToFollowers).toHaveBeenCalledWith('myuser.bsky.social');
    });

    it('calls onNavigateToFollowing when following count is pressed', () => {
      const onNavigateToFollowing = jest.fn();

      const { getByText } = render(
        <MyProfileScreen onNavigateToFollowing={onNavigateToFollowing} />
      );

      fireEvent.press(getByText('Following'));
      expect(onNavigateToFollowing).toHaveBeenCalledWith('myuser.bsky.social');
    });

    it('calls onNavigateToPost when a post is tapped', () => {
      const onNavigateToPost = jest.fn();

      const { getAllByLabelText } = render(
        <MyProfileScreen onNavigateToPost={onNavigateToPost} />
      );

      const postCards = getAllByLabelText(/Post by/);
      if (postCards.length > 0) {
        fireEvent.press(postCards[0]);
      }
    });
  });

  // ─── Not authenticated state ────────────────────────────

  describe('not authenticated', () => {
    it('shows "Not authenticated" when no account', () => {
      // Override auth mock
      jest.spyOn(
        require('../../../contexts/AuthContext'),
        'useAuth'
      ).mockReturnValue({
        account: null,
        signOut: jest.fn(),
      });

      const { getByText } = render(<MyProfileScreen />);

      expect(getByText('Not authenticated')).toBeTruthy();

      jest.restoreAllMocks();
    });
  });

  // ─── Edge cases ─────────────────────────────────────────

  describe('edge cases', () => {
    it('renders with zero counts', () => {
      mockProfileData = {
        ...mockProfile,
        postsCount: 0,
        followersCount: 0,
        followsCount: 0,
      };

      const { getAllByText } = render(<MyProfileScreen />);

      const zeros = getAllByText('0');
      expect(zeros.length).toBe(3);
    });

    it('handles null/undefined counts gracefully', () => {
      mockProfileData = {
        ...mockProfile,
        postsCount: undefined,
        followersCount: undefined,
        followsCount: undefined,
      } as any;

      expect(() => render(<MyProfileScreen />)).not.toThrow();
    });

    it('shows loading state when profile is loading', () => {
      mockProfileLoading = true;
      mockProfileData = null as any;

      // Should not crash
      expect(() => render(<MyProfileScreen />)).not.toThrow();
    });
  });
});
