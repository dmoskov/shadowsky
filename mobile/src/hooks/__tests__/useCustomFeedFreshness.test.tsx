import { renderHook, act } from '@testing-library/react-native';
import { useCustomFeedFreshness } from '../useCustomFeedFreshness';
import { getFeed } from '../../services/atproto/feeds';

jest.mock('../../services/atproto/feeds', () => ({
  getFeed: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

const mockGetFeed = getFeed as jest.MockedFunction<typeof getFeed>;

const FEED_URI = 'at://did:plc:x/app.bsky.feed.generator/foryou';

function peekResponse(uri: string | undefined) {
  return {
    feed: uri ? [{ post: { uri } }] : [],
    cursor: undefined,
  } as Awaited<ReturnType<typeof getFeed>>;
}

describe('useCustomFeedFreshness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetFeed.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderFreshness(
    feedUri: string | null,
    topPostUri: string | undefined,
  ) {
    return renderHook(
      (props: { feedUri: string | null; topPostUri: string | undefined }) =>
        useCustomFeedFreshness({ ...props, isReady: true }),
      { initialProps: { feedUri, topPostUri } },
    );
  }

  it('signals new posts when the feed head has changed upstream', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/2'));
    const { result } = renderFreshness(FEED_URI, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });

    expect(mockGetFeed).toHaveBeenCalledWith(FEED_URI, { limit: 1 });
    expect(result.current.hasNewPosts).toBe(true);
  });

  it('does not signal when the head is unchanged', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/1'));
    const { result } = renderFreshness(FEED_URI, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });

    expect(mockGetFeed).toHaveBeenCalled();
    expect(result.current.hasNewPosts).toBe(false);
  });

  it('never peeks on the Following timeline (feedUri null)', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/2'));
    renderFreshness(null, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(180_000);
    });

    expect(mockGetFeed).not.toHaveBeenCalled();
  });

  it('stops peeking once the signal is raised', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/2'));
    const { result } = renderFreshness(FEED_URI, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);
    const callsAfterFirst = mockGetFeed.mock.calls.length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(180_000);
    });
    expect(mockGetFeed.mock.calls.length).toBe(callsAfterFirst);
  });

  it('clearNewPosts resets the signal', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/2'));
    const { result } = renderFreshness(FEED_URI, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);

    act(() => {
      result.current.clearNewPosts();
    });
    expect(result.current.hasNewPosts).toBe(false);
  });

  it('clears the signal when the cached head catches up (external refresh)', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/2'));
    const { result, rerender } = renderFreshness(FEED_URI, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);

    act(() => {
      rerender({ feedUri: FEED_URI, topPostUri: 'at://post/2' });
    });
    expect(result.current.hasNewPosts).toBe(false);
  });

  it('resets the signal when switching feeds', async () => {
    mockGetFeed.mockResolvedValue(peekResponse('at://post/2'));
    const { result, rerender } = renderFreshness(FEED_URI, 'at://post/1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);

    act(() => {
      rerender({
        feedUri: 'at://did:plc:y/app.bsky.feed.generator/other',
        topPostUri: 'at://post/9',
      });
    });
    expect(result.current.hasNewPosts).toBe(false);
  });
});
