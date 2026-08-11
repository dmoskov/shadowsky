import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { mockTheme } from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

const mockShowToast = jest.fn();
jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockEditPost = jest.fn();
jest.mock('../../hooks/api/usePosts', () => ({
  useEditPost: () => ({ mutateAsync: mockEditPost }),
}));

jest.mock('../BlurOverlay', () => ({
  BlurOverlay: () => null,
}));

// ─── Import after mocks ───────────────────────────────────
import { EditPostModal } from '../EditPostModal';

const VIEWER = 'did:plc:me';

function makePost(overrides: Record<string, any> = {}) {
  const { record: recordOverrides, author: authorOverrides, ...rest } = overrides;
  return {
    uri: 'at://did:plc:me/app.bsky.feed.post/abc',
    cid: 'bafyabc',
    author: { did: VIEWER, handle: 'me.bsky.social', ...authorOverrides },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'helo world',
      createdAt: new Date().toISOString(),
      ...recordOverrides,
    },
    likeCount: 0,
    repostCount: 0,
    replyCount: 0,
    quoteCount: 0,
    indexedAt: new Date().toISOString(),
    ...rest,
  };
}

function renderModal(post: any, props: Record<string, any> = {}) {
  return render(
    <EditPostModal
      visible
      post={post}
      currentUserDid={VIEWER}
      onClose={jest.fn()}
      {...props}
    />,
  );
}

describe('EditPostModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEditPost.mockResolvedValue({ uri: 'x', cid: 'y' });
  });

  it('seeds the editor with the post text and a countdown', () => {
    const { getByTestId } = renderModal(makePost());

    expect(getByTestId('edit-post-input').props.value).toBe('helo world');
    expect(getByTestId('edit-post-countdown').props.children.join('')).toBe(
      '15m 00s left to edit',
    );
  });

  // ─── Cost disclosure ─────────────────────────────────────
  describe('cost disclosure', () => {
    it('says nothing about counts when there is no engagement to lose', () => {
      const { queryByTestId } = renderModal(makePost());

      expect(queryByTestId('edit-post-count-warning')).toBeNull();
      expect(queryByTestId('edit-post-quote-warning')).toBeNull();
    });

    it('warns that counts restart, listing what stops being counted', () => {
      const { getByTestId, getByText } = renderModal(
        makePost({ likeCount: 3, repostCount: 1, replyCount: 2 }),
      );

      expect(getByTestId('edit-post-count-warning')).toBeTruthy();
      // Singular/plural is inflected per count, and the copy is explicit that
      // the engagement survives even though other clients will show zero.
      expect(getByText(/3 likes, 1 repost, 2 replies/)).toBeTruthy();
      expect(getByText(/Nothing is deleted/)).toBeTruthy();
    });

    it('warns about quote rewriting separately from the counters', () => {
      // Quote rewriting is not proportional to post age, so it earns its own
      // warning rather than being folded into the counter disclosure.
      const { getByTestId, getByText } = renderModal(makePost({ quoteCount: 2 }));

      expect(getByTestId('edit-post-count-warning')).toBeTruthy();
      expect(getByTestId('edit-post-quote-warning')).toBeTruthy();
      expect(getByText(/2 people have quoted this post/)).toBeTruthy();
    });

    it('discloses cost without blocking the edit', async () => {
      // Heavy engagement is a warning, not a veto — the author decides.
      const { getByTestId, getByText } = renderModal(
        makePost({ likeCount: 99, quoteCount: 5 }),
      );

      fireEvent.changeText(getByTestId('edit-post-input'), 'hello world');
      await act(async () => {
        fireEvent.press(getByText('Save Changes'));
      });

      expect(mockEditPost).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Length limit ────────────────────────────────────────
  describe('length limit', () => {
    it('counts graphemes, not UTF-16 units', () => {
      const { getByTestId } = renderModal(makePost());

      // A single emoji is one grapheme but two UTF-16 code units.
      fireEvent.changeText(getByTestId('edit-post-input'), '👍');
      expect(getByTestId('edit-post-char-count').props.children.join('')).toBe(
        '1/300',
      );
    });

    it('blocks saving past 300 graphemes', () => {
      const { getByTestId, getByText } = renderModal(makePost());

      fireEvent.changeText(getByTestId('edit-post-input'), 'a'.repeat(301));
      expect(getByTestId('edit-post-char-count').props.children.join('')).toBe(
        '301/300',
      );

      fireEvent.press(getByText('Save Changes'));
      expect(mockEditPost).not.toHaveBeenCalled();
    });
  });

  // ─── Saving ──────────────────────────────────────────────
  describe('saving', () => {
    it('sends the trimmed new text and closes', async () => {
      const onClose = jest.fn();
      const { getByTestId, getByText } = renderModal(makePost(), { onClose });

      fireEvent.changeText(getByTestId('edit-post-input'), '  hello world  ');
      await act(async () => {
        fireEvent.press(getByText('Save Changes'));
      });

      expect(mockEditPost).toHaveBeenCalledWith({
        uri: 'at://did:plc:me/app.bsky.feed.post/abc',
        text: 'hello world',
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('refuses to save an unchanged post', () => {
      const { getByText } = renderModal(makePost());

      fireEvent.press(getByText('Save Changes'));
      expect(mockEditPost).not.toHaveBeenCalled();
    });

    it('refuses to save an emptied post', () => {
      const { getByTestId, getByText } = renderModal(makePost());

      fireEvent.changeText(getByTestId('edit-post-input'), '   ');
      fireEvent.press(getByText('Save Changes'));
      expect(mockEditPost).not.toHaveBeenCalled();
    });

    it('tells the author counts will reset when there was engagement', async () => {
      const { getByTestId, getByText } = renderModal(makePost({ likeCount: 4 }));

      fireEvent.changeText(getByTestId('edit-post-input'), 'hello world');
      await act(async () => {
        fireEvent.press(getByText('Save Changes'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Post edited. Engagement counts will restart from zero.',
        { type: 'success' },
      );
    });

    it('reports the failure in place instead of closing', async () => {
      mockEditPost.mockRejectedValue(new Error('Cannot edit post: not authenticated'));
      const onClose = jest.fn();
      const { getByTestId, getByText } = renderModal(makePost(), { onClose });

      fireEvent.changeText(getByTestId('edit-post-input'), 'hello world');
      await act(async () => {
        fireEvent.press(getByText('Save Changes'));
      });

      // The underlying message is surfaced rather than replaced with a generic
      // one, so the author can tell a session problem from a validation problem.
      expect(getByTestId('edit-post-error').props.children).toBe(
        'Cannot edit post: not authenticated',
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ─── Eligibility ─────────────────────────────────────────
  describe('eligibility', () => {
    it('explains the closed window instead of offering an editor', () => {
      const { queryByTestId, getByText } = renderModal(
        makePost({ record: { createdAt: '2020-01-01T00:00:00.000Z' } }),
      );

      expect(queryByTestId('edit-post-input')).toBeNull();
      // Names the alternative rather than just refusing.
      expect(
        getByText(/edit window for this post has closed.*delete it and post again/s),
      ).toBeTruthy();
    });

    it("refuses to edit someone else's post", () => {
      const { queryByTestId } = renderModal(
        makePost({ author: { did: 'did:plc:someone-else' } }),
      );

      expect(queryByTestId('edit-post-input')).toBeNull();
    });

    it('closes the editor when the window lapses while it is open', () => {
      jest.useFakeTimers();
      try {
        // Two minutes of window left when the sheet opens.
        const createdAt = new Date(Date.now() - 13 * 60 * 1000).toISOString();
        const { getByTestId, queryByTestId } = renderModal(
          makePost({ record: { createdAt } }),
        );

        expect(getByTestId('edit-post-input')).toBeTruthy();

        // The per-second tick re-evaluates eligibility, so the editor is
        // replaced rather than leaving a save button that would be rejected.
        act(() => {
          jest.advanceTimersByTime(3 * 60 * 1000);
        });

        expect(queryByTestId('edit-post-input')).toBeNull();
        expect(queryByTestId('edit-post-expired')).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
