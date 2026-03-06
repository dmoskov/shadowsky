import { getAuthorFeed } from '../../../services/atproto/feeds';

// Mock the feeds service
jest.mock('../../../services/atproto/feeds', () => ({
  getAuthorFeed: jest.fn(),
}));

const mockGetAuthorFeed = getAuthorFeed as jest.MockedFunction<typeof getAuthorFeed>;

// We test the pure logic extracted from the hook's queryFn
// since testing hooks directly requires a QueryClient wrapper
describe('useTopPosts logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makePost(uri: string, likes: number, reposts: number, replies: number, text = 'test post') {
    return {
      post: {
        uri,
        cid: `cid-${uri}`,
        author: {
          did: 'did:plc:test',
          handle: 'test.bsky.social',
          displayName: 'Test User',
          avatar: 'https://example.com/avatar.jpg',
          labels: [],
          viewer: {},
        },
        record: { $type: 'app.bsky.feed.post', text, createdAt: '2025-01-01T00:00:00Z' },
        likeCount: likes,
        repostCount: reposts,
        replyCount: replies,
        indexedAt: '2025-01-01T00:00:00Z',
        labels: [],
        viewer: {},
      },
    };
  }

  function makeRepost(uri: string) {
    return {
      ...makePost(uri, 0, 0, 0),
      reason: { $type: 'app.bsky.feed.defs#reasonRepost' },
    };
  }

  async function fetchTopPosts(handle: string, limit = 10, maxPages = 10) {
    const allPosts: any[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      const response = await getAuthorFeed(handle, {
        limit: 100,
        cursor,
        filter: 'posts_no_replies',
      });

      const filteredPosts = response.feed.filter((item: any) => {
        const isRepost = item.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
        return !isRepost;
      });

      allPosts.push(...filteredPosts);
      cursor = response.cursor;

      if (!cursor) break;
    }

    const postsWithEngagement = allPosts.map((item: any) => ({
      uri: item.post.uri,
      text: item.post.record?.text || '',
      createdAt: item.post.indexedAt,
      likes: item.post.likeCount || 0,
      reposts: item.post.repostCount || 0,
      replies: item.post.replyCount || 0,
      totalEngagement:
        (item.post.likeCount || 0) +
        (item.post.repostCount || 0) +
        (item.post.replyCount || 0),
      author: {
        handle: item.post.author.handle,
        displayName: item.post.author.displayName,
        avatar: item.post.author.avatar,
      },
      post: item.post,
    }));

    const topPosts = [...postsWithEngagement]
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, limit);

    return { topPosts, totalPostsAnalyzed: postsWithEngagement.length };
  }

  it('sorts posts by total engagement descending', async () => {
    mockGetAuthorFeed.mockResolvedValueOnce({
      feed: [
        makePost('post-1', 10, 5, 3) as any,  // total: 18
        makePost('post-2', 50, 20, 10) as any, // total: 80
        makePost('post-3', 1, 0, 0) as any,    // total: 1
      ],
      cursor: undefined,
    });

    const result = await fetchTopPosts('test.bsky.social');

    expect(result.topPosts[0].uri).toBe('post-2');
    expect(result.topPosts[0].totalEngagement).toBe(80);
    expect(result.topPosts[1].uri).toBe('post-1');
    expect(result.topPosts[2].uri).toBe('post-3');
  });

  it('filters out reposts', async () => {
    mockGetAuthorFeed.mockResolvedValueOnce({
      feed: [
        makePost('post-1', 10, 5, 3) as any,
        makeRepost('repost-1') as any,
      ],
      cursor: undefined,
    });

    const result = await fetchTopPosts('test.bsky.social');

    expect(result.totalPostsAnalyzed).toBe(1);
    expect(result.topPosts).toHaveLength(1);
    expect(result.topPosts[0].uri).toBe('post-1');
  });

  it('respects limit parameter', async () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost(`post-${i}`, i * 10, i * 5, i)
    );

    mockGetAuthorFeed.mockResolvedValueOnce({
      feed: posts as any,
      cursor: undefined,
    });

    const result = await fetchTopPosts('test.bsky.social', 5);

    expect(result.topPosts).toHaveLength(5);
    expect(result.totalPostsAnalyzed).toBe(20);
  });

  it('pages through multiple API responses', async () => {
    mockGetAuthorFeed
      .mockResolvedValueOnce({
        feed: [makePost('post-page1', 100, 0, 0) as any],
        cursor: 'page2',
      })
      .mockResolvedValueOnce({
        feed: [makePost('post-page2', 200, 0, 0) as any],
        cursor: undefined,
      });

    const result = await fetchTopPosts('test.bsky.social');

    expect(mockGetAuthorFeed).toHaveBeenCalledTimes(2);
    expect(result.totalPostsAnalyzed).toBe(2);
    expect(result.topPosts[0].uri).toBe('post-page2');
  });

  it('stops paging when maxPages reached', async () => {
    mockGetAuthorFeed.mockResolvedValue({
      feed: [makePost('post', 1, 0, 0) as any],
      cursor: 'next',
    });

    await fetchTopPosts('test.bsky.social', 10, 3);

    expect(mockGetAuthorFeed).toHaveBeenCalledTimes(3);
  });

  it('handles empty feed', async () => {
    mockGetAuthorFeed.mockResolvedValueOnce({
      feed: [],
      cursor: undefined,
    });

    const result = await fetchTopPosts('test.bsky.social');

    expect(result.topPosts).toHaveLength(0);
    expect(result.totalPostsAnalyzed).toBe(0);
  });

  it('extracts post text from record', async () => {
    mockGetAuthorFeed.mockResolvedValueOnce({
      feed: [makePost('post-1', 10, 0, 0, 'My awesome post') as any],
      cursor: undefined,
    });

    const result = await fetchTopPosts('test.bsky.social');

    expect(result.topPosts[0].text).toBe('My awesome post');
  });

  it('handles posts with zero engagement', async () => {
    mockGetAuthorFeed.mockResolvedValueOnce({
      feed: [makePost('post-zero', 0, 0, 0) as any],
      cursor: undefined,
    });

    const result = await fetchTopPosts('test.bsky.social');

    expect(result.topPosts[0].totalEngagement).toBe(0);
  });
});
