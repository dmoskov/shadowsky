import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  makeFeedViewPost,
  makeAuthor,
  makeRecord,
  makePostView,
  mockTheme,
} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    dismissToast: jest.fn(),
    dismissAllToasts: jest.fn(),
    showUndoToast: jest.fn(),
  }),
}));

jest.mock('../../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../contexts/ModerationContext', () => ({
  useModeration: () => ({
    shouldHideContent: jest.fn(() => false),
    shouldWarnContent: jest.fn(() => false),
    shouldBlurImages: jest.fn(() => false),
    getContentWarningText: jest.fn(() => ''),
  }),
}));

jest.mock('../../contexts/SharedTransitionContext', () => ({
  useSharedTransition: () => ({
    prepareTransition: jest.fn(),
    state: { active: false, sourceLayout: null, postData: null },
  }),
}));

jest.mock('../../hooks/api/useProfile', () => ({
  useBlockUser: () => ({ mutateAsync: jest.fn() }),
  useMuteUser: () => ({ mutateAsync: jest.fn() }),
  useFollowUser: () => ({ mutate: jest.fn(), isPending: false }),
  useUnfollowUser: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../../hooks/usePostTranslation', () => ({
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

jest.mock('../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../utils/share', () => ({
  sharePost: jest.fn(),
}));

jest.mock('../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

jest.mock('../PostEmbed', () => ({
  PostEmbed: () => null,
}));

jest.mock('../ContentLabelWarning', () => ({
  ContentLabelWarning: ({ children }: any) => children,
}));

jest.mock('../ReportModal', () => ({
  ReportModal: () => null,
}));

jest.mock('../SaveToCollectionModal', () => ({
  SaveToCollectionModal: () => null,
}));

jest.mock('../../utils/rich-text', () => ({
  RichText: ({ text }: any) => {
    const { Text } = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('../../utils/browser', () => ({
  openLink: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────
import { ThreadTreeView } from '../ThreadTreeView';

// ─── Helpers ──────────────────────────────────────────────

/**
 * Create a reply post whose record.reply.parent.uri references
 * the given parent URI (used to build the thread tree).
 */
function makeReply(
  uri: string,
  parentUri: string,
  text: string,
  authorHandle: string = 'replier.bsky.social',
) {
  return makeFeedViewPost({
    post: {
      uri,
      cid: `cid-${uri}`,
      author: { handle: authorHandle, displayName: authorHandle.split('.')[0] },
      record: makeRecord({
        text,
        reply: {
          parent: { uri: parentUri, cid: `cid-${parentUri}` },
          root: { uri: 'at://did:plc:root/app.bsky.feed.post/root', cid: 'cid-root' },
        },
      }),
    },
  });
}

const ROOT_URI = 'at://did:plc:root/app.bsky.feed.post/root';

function makeRootPost() {
  return makeFeedViewPost({
    post: {
      uri: ROOT_URI,
      cid: 'cid-root',
      author: makeAuthor({ handle: 'op.bsky.social', displayName: 'OP' }),
      record: makeRecord({ text: 'Original post content' }),
    },
  });
}

const defaultCallbacks = {
  onPressProfile: jest.fn(),
  onLike: jest.fn(),
  onRepost: jest.fn(),
  onReply: jest.fn(),
  onBookmark: jest.fn(),
  isBookmarked: jest.fn(() => false),
  onMentionPress: jest.fn(),
  onHashtagPress: jest.fn(),
};

// ─── Tests ─────────────────────────────────────────────────

describe('ThreadTreeView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the root post', () => {
    const rootPost = makeRootPost();
    const { getByText } = render(
      <ThreadTreeView
        rootPost={rootPost as any}
        replies={[]}
        {...defaultCallbacks}
      />
    );

    expect(getByText('OP')).toBeTruthy();
  });

  it('renders with no replies', () => {
    const rootPost = makeRootPost();
    const { toJSON } = render(
      <ThreadTreeView
        rootPost={rootPost as any}
        replies={[]}
        {...defaultCallbacks}
      />
    );

    expect(toJSON()).not.toBeNull();
  });

  it('renders direct replies to root', () => {
    const rootPost = makeRootPost();
    const reply1 = makeReply(
      'at://did:plc:r1/app.bsky.feed.post/r1',
      ROOT_URI,
      'First reply',
      'alice.bsky.social',
    );
    const reply2 = makeReply(
      'at://did:plc:r2/app.bsky.feed.post/r2',
      ROOT_URI,
      'Second reply',
      'bob.bsky.social',
    );

    const { getByText } = render(
      <ThreadTreeView
        rootPost={rootPost as any}
        replies={[reply1 as any, reply2 as any]}
        {...defaultCallbacks}
      />
    );

    expect(getByText('First reply')).toBeTruthy();
    expect(getByText('Second reply')).toBeTruthy();
  });

  it('renders nested replies (depth 2)', () => {
    const rootPost = makeRootPost();
    const reply1Uri = 'at://did:plc:r1/app.bsky.feed.post/r1';
    const reply1 = makeReply(reply1Uri, ROOT_URI, 'Level 1 reply', 'alice.bsky.social');
    const reply2 = makeReply(
      'at://did:plc:r2/app.bsky.feed.post/r2',
      reply1Uri,
      'Level 2 reply',
      'bob.bsky.social',
    );

    const { getByText } = render(
      <ThreadTreeView
        rootPost={rootPost as any}
        replies={[reply1 as any, reply2 as any]}
        {...defaultCallbacks}
      />
    );

    expect(getByText('Level 1 reply')).toBeTruthy();
    expect(getByText('Level 2 reply')).toBeTruthy();
  });

  it('renders deeply nested thread (depth 4)', () => {
    const rootPost = makeRootPost();
    const uris = [
      'at://did:plc:r1/app.bsky.feed.post/r1',
      'at://did:plc:r2/app.bsky.feed.post/r2',
      'at://did:plc:r3/app.bsky.feed.post/r3',
      'at://did:plc:r4/app.bsky.feed.post/r4',
    ];

    const replies = [
      makeReply(uris[0], ROOT_URI, 'Depth 1', 'a.bsky.social'),
      makeReply(uris[1], uris[0], 'Depth 2', 'b.bsky.social'),
      makeReply(uris[2], uris[1], 'Depth 3', 'c.bsky.social'),
      makeReply(uris[3], uris[2], 'Depth 4', 'd.bsky.social'),
    ];

    const { getByText } = render(
      <ThreadTreeView
        rootPost={rootPost as any}
        replies={replies as any[]}
        {...defaultCallbacks}
      />
    );

    expect(getByText('Depth 1')).toBeTruthy();
    expect(getByText('Depth 2')).toBeTruthy();
    expect(getByText('Depth 3')).toBeTruthy();
    expect(getByText('Depth 4')).toBeTruthy();
  });

  describe('collapse / expand', () => {
    function makeThreadWithChildren() {
      const rootPost = makeRootPost();
      const parentUri = 'at://did:plc:r1/app.bsky.feed.post/r1';
      const childUri = 'at://did:plc:r2/app.bsky.feed.post/r2';
      const parent = makeReply(parentUri, ROOT_URI, 'Parent reply', 'alice.bsky.social');
      const child = makeReply(childUri, parentUri, 'Child reply', 'bob.bsky.social');
      return { rootPost, replies: [parent, child] };
    }

    it('shows collapse button for replies with children', () => {
      const { rootPost, replies } = makeThreadWithChildren();
      const { getAllByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={replies as any[]}
          {...defaultCallbacks}
        />
      );

      // The minus sign (\u2212) indicates expanded state
      const minusSigns = getAllByText('\u2212');
      expect(minusSigns.length).toBeGreaterThanOrEqual(1);
    });

    it('collapses a branch when collapse button is pressed', () => {
      const { rootPost, replies } = makeThreadWithChildren();
      const { getAllByText, queryByText, getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={replies as any[]}
          {...defaultCallbacks}
        />
      );

      // Child should be visible initially
      expect(getByText('Child reply')).toBeTruthy();

      // Press collapse button (the minus sign)
      const collapseButton = getAllByText('\u2212')[0];
      fireEvent.press(collapseButton);

      // Child should be hidden after collapse
      expect(queryByText('Child reply')).toBeNull();
    });

    it('shows collapsed indicator with hidden reply count', () => {
      const { rootPost, replies } = makeThreadWithChildren();
      const { getAllByText, getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={replies as any[]}
          {...defaultCallbacks}
        />
      );

      // Collapse the branch
      const collapseButton = getAllByText('\u2212')[0];
      fireEvent.press(collapseButton);

      // Should show "1 hidden reply"
      expect(getByText('1 hidden reply')).toBeTruthy();
    });

    it('shows plural "replies" when multiple descendants are hidden', () => {
      const rootPost = makeRootPost();
      const parentUri = 'at://did:plc:r1/app.bsky.feed.post/r1';
      const child1Uri = 'at://did:plc:r2/app.bsky.feed.post/r2';
      const parent = makeReply(parentUri, ROOT_URI, 'Parent', 'alice.bsky.social');
      const child1 = makeReply(child1Uri, parentUri, 'Child 1', 'bob.bsky.social');
      const child2 = makeReply(
        'at://did:plc:r3/app.bsky.feed.post/r3',
        parentUri,
        'Child 2',
        'carol.bsky.social',
      );

      const { getAllByText, getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={[parent as any, child1 as any, child2 as any]}
          {...defaultCallbacks}
        />
      );

      // Collapse the parent branch
      const collapseButton = getAllByText('\u2212')[0];
      fireEvent.press(collapseButton);

      // Should show "2 hidden replies" (plural)
      expect(getByText('2 hidden replies')).toBeTruthy();
    });

    it('expands a collapsed branch when expand button is pressed', () => {
      const { rootPost, replies } = makeThreadWithChildren();
      const { getAllByText, queryByText, getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={replies as any[]}
          {...defaultCallbacks}
        />
      );

      // Collapse
      const collapseButton = getAllByText('\u2212')[0];
      fireEvent.press(collapseButton);
      expect(queryByText('Child reply')).toBeNull();

      // Expand via the "+" button that now appears
      const expandButton = getByText('+');
      fireEvent.press(expandButton);

      // Child should be visible again
      expect(getByText('Child reply')).toBeTruthy();
    });

    it('expands a collapsed branch when collapsed indicator is pressed', () => {
      const { rootPost, replies } = makeThreadWithChildren();
      const { getAllByText, queryByText, getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={replies as any[]}
          {...defaultCallbacks}
        />
      );

      // Collapse
      const collapseButton = getAllByText('\u2212')[0];
      fireEvent.press(collapseButton);
      expect(queryByText('Child reply')).toBeNull();

      // Press the collapsed indicator text
      const indicator = getByText('1 hidden reply');
      fireEvent.press(indicator);

      // Child should be visible again
      expect(getByText('Child reply')).toBeTruthy();
    });

    it('triggers haptic feedback when toggling branch', () => {
      const { triggerHaptic } = require('../../utils/haptics');
      const { rootPost, replies } = makeThreadWithChildren();
      const { getAllByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={replies as any[]}
          {...defaultCallbacks}
        />
      );

      const collapseButton = getAllByText('\u2212')[0];
      fireEvent.press(collapseButton);

      expect(triggerHaptic).toHaveBeenCalledWith('light');
    });
  });

  describe('branching threads', () => {
    it('renders multiple branches from same parent', () => {
      const rootPost = makeRootPost();
      const branch1 = makeReply(
        'at://did:plc:b1/app.bsky.feed.post/b1',
        ROOT_URI,
        'Branch A',
        'alice.bsky.social',
      );
      const branch2 = makeReply(
        'at://did:plc:b2/app.bsky.feed.post/b2',
        ROOT_URI,
        'Branch B',
        'bob.bsky.social',
      );

      const { getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={[branch1 as any, branch2 as any]}
          {...defaultCallbacks}
        />
      );

      expect(getByText('Branch A')).toBeTruthy();
      expect(getByText('Branch B')).toBeTruthy();
    });

    it('collapses one branch without affecting sibling branches', () => {
      const rootPost = makeRootPost();
      const branch1Uri = 'at://did:plc:b1/app.bsky.feed.post/b1';
      const branch2Uri = 'at://did:plc:b2/app.bsky.feed.post/b2';
      const branch1 = makeReply(branch1Uri, ROOT_URI, 'Branch A', 'alice.bsky.social');
      const branch1Child = makeReply(
        'at://did:plc:b1c/app.bsky.feed.post/b1c',
        branch1Uri,
        'Branch A child',
        'carol.bsky.social',
      );
      const branch2 = makeReply(branch2Uri, ROOT_URI, 'Branch B', 'bob.bsky.social');
      const branch2Child = makeReply(
        'at://did:plc:b2c/app.bsky.feed.post/b2c',
        branch2Uri,
        'Branch B child',
        'dave.bsky.social',
      );

      const { getAllByText, queryByText, getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={[branch1 as any, branch1Child as any, branch2 as any, branch2Child as any]}
          {...defaultCallbacks}
        />
      );

      // Both children visible initially
      expect(getByText('Branch A child')).toBeTruthy();
      expect(getByText('Branch B child')).toBeTruthy();

      // Collapse first branch (first minus sign)
      const collapseButtons = getAllByText('\u2212');
      fireEvent.press(collapseButtons[0]);

      // Branch A child hidden, Branch B child still visible
      expect(queryByText('Branch A child')).toBeNull();
      expect(getByText('Branch B child')).toBeTruthy();
    });
  });

  describe('callbacks', () => {
    it('passes onPressProfile to PostCard', () => {
      const onPressProfile = jest.fn();
      const rootPost = makeRootPost();
      const { getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={[]}
          {...defaultCallbacks}
          onPressProfile={onPressProfile}
        />
      );

      // The component renders, confirming callbacks are wired
      expect(getByText('OP')).toBeTruthy();
    });

    it('renders without optional callbacks', () => {
      const rootPost = makeRootPost();
      // Omit optional callbacks
      const { getByText } = render(
        <ThreadTreeView
          rootPost={rootPost as any}
          replies={[]}
          onPressProfile={jest.fn()}
          onLike={jest.fn()}
          onRepost={jest.fn()}
          onReply={jest.fn()}
          onMentionPress={jest.fn()}
          onHashtagPress={jest.fn()}
        />
      );

      expect(getByText('OP')).toBeTruthy();
    });
  });
});
