import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ session: { did: 'did:plc:owner123' } }),
}));

jest.mock('../../../components/EditListModal', () => ({
  EditListModal: (props: any) => {
    const { View } = require('react-native');
    return props.visible ? <View testID="edit-list-modal" /> : null;
  },
}));

jest.mock('../../../components/UserListSkeleton', () => ({
  UserListSkeleton: () => {
    const { View } = require('react-native');
    return <View testID="user-list-skeleton" />;
  },
}));

const mockGoBack = jest.fn();
const mockRouterPush = jest.fn();
jest.mock('../../../hooks/useNavigation', () => ({
  useAppNavigation: () => ({
    goBack: mockGoBack,
    router: { push: mockRouterPush },
  }),
}));

let mockListData: any = null;
let mockIsLoadingList = false;
let mockMembersData: any = undefined;
let mockIsLoadingMembers = true;
let mockMembersError: any = null;
const mockRefetch = jest.fn();
const mockFetchNextPage = jest.fn();
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;
let mockIsRefetching = false;
const mockRemoveFromList = jest.fn();
const mockDeleteList = jest.fn();
const mockUpdateList = jest.fn();

jest.mock('../../../hooks/api', () => ({
  useList: () => ({ data: mockListData, isLoading: mockIsLoadingList }),
  useListMembers: () => ({
    data: mockMembersData,
    isLoading: mockIsLoadingMembers,
    error: mockMembersError,
    refetch: mockRefetch,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
    isRefetching: mockIsRefetching,
  }),
  useRemoveFromList: () => ({ mutateAsync: mockRemoveFromList }),
  useDeleteList: () => ({ mutateAsync: mockDeleteList }),
  useUpdateList: () => ({ mutateAsync: mockUpdateList }),
}));

// ─── Import after mocks ───────────────────────────────────
import { ListDetailScreen } from '../ListDetailScreen';

// ─── Factories ─────────────────────────────────────────────

function makeListInfo(name: string, ownerDid = 'did:plc:owner123') {
  return {
    uri: `at://${ownerDid}/app.bsky.graph.list/list1`,
    name,
    description: `Description of ${name}`,
    listItemCount: 5,
    purpose: 'app.bsky.graph.defs#curatelist',
    creator: { did: ownerDid, handle: 'owner.bsky.social' },
  };
}

function makeMember(handle: string) {
  return {
    uri: `at://did:plc:${handle}/app.bsky.graph.listitem/item1`,
    subject: {
      did: `did:plc:${handle}`,
      handle: `${handle}.bsky.social`,
      displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
      avatar: `https://example.com/${handle}.jpg`,
    },
  };
}

function makeMembersPage(members: any[]) {
  return {
    pages: [{ items: members, cursor: 'cursor-1' }],
    pageParams: [undefined],
  };
}

// ─── Constants ─────────────────────────────────────────────

const LIST_URI = 'at://did:plc:owner123/app.bsky.graph.list/list1';

// ─── Tests ─────────────────────────────────────────────────

describe('ListDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListData = null;
    mockIsLoadingList = false;
    mockMembersData = undefined;
    mockIsLoadingMembers = true;
    mockMembersError = null;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
    mockIsRefetching = false;
  });

  // ─── Loading state ─────────────────────────────────────

  describe('loading state', () => {
    it('renders UserListSkeleton while loading', () => {
      mockIsLoadingList = true;
      mockIsLoadingMembers = true;

      const { getByTestId } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByTestId('user-list-skeleton')).toBeTruthy();
    });
  });

  // ─── Header rendering ─────────────────────────────────

  describe('header rendering', () => {
    beforeEach(() => {
      mockListData = makeListInfo('My Cool List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersData = makeMembersPage([
        makeMember('alice'),
        makeMember('bob'),
      ]);
    });

    it('renders list name', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('My Cool List')).toBeTruthy();
    });

    it('renders list description', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Description of My Cool List')).toBeTruthy();
    });

    it('renders member count', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('5 members')).toBeTruthy();
    });

    it('renders Curate List purpose for curatelist', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Curate List')).toBeTruthy();
    });

    it('renders Mod List purpose for modlist', () => {
      mockListData = {
        ...makeListInfo('Moderation Rules'),
        purpose: 'app.bsky.graph.defs#modlist',
      };

      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Mod List')).toBeTruthy();
    });
  });

  // ─── Members rendering ────────────────────────────────

  describe('members rendering', () => {
    beforeEach(() => {
      mockListData = makeListInfo('Test List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersData = makeMembersPage([
        makeMember('alice'),
        makeMember('bob'),
      ]);
    });

    it('renders member display names', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });

    it('renders member handles with @ prefix', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('@alice.bsky.social')).toBeTruthy();
      expect(getByText('@bob.bsky.social')).toBeTruthy();
    });
  });

  // ─── Error state ──────────────────────────────────────

  describe('error state', () => {
    it('renders "Failed to load members" on error', () => {
      mockListData = makeListInfo('Error List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersError = new Error('Network failure');
      mockMembersData = undefined;

      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Failed to load members')).toBeTruthy();
    });

    it('renders error message detail', () => {
      mockListData = makeListInfo('Error List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersError = new Error('Network failure');
      mockMembersData = undefined;

      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Network failure')).toBeTruthy();
    });

    it('renders Retry button that calls refetch', () => {
      mockListData = makeListInfo('Error List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersError = new Error('Network failure');
      mockMembersData = undefined;

      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      const retryButton = getByText('Retry');
      expect(retryButton).toBeTruthy();

      fireEvent.press(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  // ─── Empty state ──────────────────────────────────────

  describe('empty state', () => {
    it('renders "No members yet" when list is empty', () => {
      mockListData = makeListInfo('Empty List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersError = null;
      mockMembersData = makeMembersPage([]);

      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('No members yet')).toBeTruthy();
    });
  });

  // ─── Owner actions (Edit/Delete) ──────────────────────

  describe('owner actions', () => {
    beforeEach(() => {
      mockListData = makeListInfo('Owner List', 'did:plc:owner123');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersData = makeMembersPage([makeMember('alice')]);
    });

    it('shows Edit button for the list owner', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Edit')).toBeTruthy();
    });

    it('shows Delete button for the list owner', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      expect(getByText('Delete')).toBeTruthy();
    });

    it('opens EditListModal when Edit is pressed', () => {
      const { getByText, getByTestId } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      fireEvent.press(getByText('Edit'));
      expect(getByTestId('edit-list-modal')).toBeTruthy();
    });
  });

  // ─── Owner: Remove button on members ──────────────────

  describe('owner remove button', () => {
    beforeEach(() => {
      mockListData = makeListInfo('Owner List', 'did:plc:owner123');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersData = makeMembersPage([
        makeMember('alice'),
        makeMember('bob'),
      ]);
    });

    it('shows Remove button for each member when owner', () => {
      const { getAllByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      const removeButtons = getAllByText('Remove');
      expect(removeButtons.length).toBe(2);
    });
  });

  // ─── Non-owner: hidden actions ────────────────────────

  describe('non-owner view', () => {
    const NON_OWNER_URI =
      'at://did:plc:someone_else/app.bsky.graph.list/list1';

    beforeEach(() => {
      mockListData = makeListInfo('Other List', 'did:plc:someone_else');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersData = makeMembersPage([makeMember('alice')]);
    });

    it('does not show Edit button for non-owner', () => {
      const { queryByText } = render(
        <ListDetailScreen listUri={NON_OWNER_URI} />,
      );

      expect(queryByText('Edit')).toBeNull();
    });

    it('does not show Delete button for non-owner', () => {
      const { queryByText } = render(
        <ListDetailScreen listUri={NON_OWNER_URI} />,
      );

      expect(queryByText('Delete')).toBeNull();
    });

    it('does not show Remove button on members for non-owner', () => {
      const { queryByText } = render(
        <ListDetailScreen listUri={NON_OWNER_URI} />,
      );

      expect(queryByText('Remove')).toBeNull();
    });
  });

  // ─── Member press navigation ──────────────────────────

  describe('member press navigation', () => {
    beforeEach(() => {
      mockListData = makeListInfo('Nav List');
      mockIsLoadingList = false;
      mockIsLoadingMembers = false;
      mockMembersData = makeMembersPage([makeMember('alice')]);
    });

    it('navigates to member profile when member is pressed', () => {
      const { getByText } = render(
        <ListDetailScreen listUri={LIST_URI} />,
      );

      fireEvent.press(getByText('Alice'));
      expect(mockRouterPush).toHaveBeenCalledWith(
        '/(app)/lists/profile/alice.bsky.social',
      );
    });
  });
});
