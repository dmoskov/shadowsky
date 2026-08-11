import { serializeFeedViewPost, serializeFeedPosts } from '../serializer';

const makeAuthor = (overrides = {}) => ({
  did: 'did:plc:test123',
  handle: 'alice.bsky.social',
  displayName: 'Alice',
  avatar: 'https://cdn.bsky.app/avatar.jpg',
  ...overrides,
});

const makePost = (overrides: any = {}) => {
  const { record: recordOverrides, ...rest } = overrides;
  return {
    uri: 'at://did:plc:test123/app.bsky.feed.post/abc',
    cid: 'bafyabc',
    author: makeAuthor(),
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Hello world',
      createdAt: '2025-01-01T00:00:00.000Z',
      ...recordOverrides,
    },
    indexedAt: '2025-01-01T00:00:00.000Z',
    likeCount: 5,
    repostCount: 2,
    replyCount: 1,
    viewer: { like: undefined, repost: undefined },
    labels: [],
    ...rest,
  };
};

const makeFeedViewPost = (overrides: any = {}) => {
  const { post: postOverrides, ...rest } = overrides;
  return {
    post: makePost(postOverrides),
    ...rest,
  };
};

describe('serializeFeedViewPost', () => {
  it('serializes a basic post', () => {
    const result = serializeFeedViewPost(makeFeedViewPost());
    expect(result.post.uri).toBe('at://did:plc:test123/app.bsky.feed.post/abc');
    expect(result.post.author.handle).toBe('alice.bsky.social');
    expect(result.post.record.text).toBe('Hello world');
  });

  // The native "Edited" indicator reads this field, and it is not part of the
  // app.bsky.feed.post lexicon, so it has to be lifted off the raw record.
  it('carries the updatedAt edit stamp across the bridge', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: { record: { updatedAt: '2025-01-01T00:05:00.000Z' } },
    }));
    expect(result.post.record.updatedAt).toBe('2025-01-01T00:05:00.000Z');
  });

  it('omits updatedAt for a post that has never been edited', () => {
    const result = serializeFeedViewPost(makeFeedViewPost());
    expect(result.post.record.updatedAt).toBeUndefined();
  });

  it('ignores a non-string updatedAt rather than forwarding junk', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: { record: { updatedAt: 12345 } },
    }));
    expect(result.post.record.updatedAt).toBeUndefined();
  });

  it('serializes image embeds', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.images#view',
          images: [
            { thumb: 'https://img/t.jpg', fullsize: 'https://img/f.jpg', alt: 'test' },
          ],
        },
      },
    }));
    expect(result.post.embed?.$type).toBe('app.bsky.embed.images#view');
  });

  it('serializes external link embeds', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.external#view',
          external: {
            uri: 'https://example.com',
            title: 'Example',
            description: 'A site',
            thumb: 'https://img/thumb.jpg',
          },
        },
      },
    }));
    expect(result.post.embed?.$type).toBe('app.bsky.embed.external#view');
  });

  it('serializes quote embeds', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.record#view',
          record: {
            $type: 'app.bsky.embed.record#viewRecord',
            uri: 'at://did:plc:other/app.bsky.feed.post/xyz',
            cid: 'bafyxyz',
            author: makeAuthor({ handle: 'bob.bsky.social' }),
            value: { text: 'Quoted post', createdAt: '2025-01-01T00:00:00.000Z' },
            indexedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
    }));
    expect(result.post.embed?.$type).toBe('app.bsky.embed.record#view');
  });

  it('handles deleted/blocked quote embeds (record missing fields)', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.record#view',
          record: {
            $type: 'app.bsky.embed.record#viewNotFound',
            uri: 'at://did:plc:deleted/app.bsky.feed.post/gone',
          },
        },
      },
    }));
    // Should not throw — record has no cid/author/value
    expect(result.post.embed).toBeUndefined();
  });

  it('handles blocked quote embeds (record is viewBlocked)', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.record#view',
          record: {
            $type: 'app.bsky.embed.record#viewBlocked',
            uri: 'at://did:plc:blocked/app.bsky.feed.post/blocked',
            blocked: true,
            author: { did: 'did:plc:blocked', handle: 'blocked.user' },
          },
        },
      },
    }));
    // viewBlocked has a uri but no cid — our guard checks for uri so it may pass through
    // but author serialization should still work
    expect(result).toBeDefined();
  });

  it('handles recordWithMedia with missing inner record', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.recordWithMedia#view',
          record: {
            record: {
              $type: 'app.bsky.embed.record#viewNotFound',
              // No uri, cid, author, value — deleted post
            },
          },
          media: {
            $type: 'app.bsky.embed.images#view',
            images: [{ thumb: 'https://img/t.jpg', fullsize: 'https://img/f.jpg', alt: '' }],
          },
        },
      },
    }));
    // Should not throw
    expect(result.post.embed).toBeUndefined();
  });

  it('handles recordWithMedia with valid inner record', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.recordWithMedia#view',
          record: {
            record: {
              $type: 'app.bsky.embed.record#viewRecord',
              uri: 'at://did:plc:other/app.bsky.feed.post/xyz',
              cid: 'bafyxyz',
              author: makeAuthor({ handle: 'bob.bsky.social' }),
              value: { text: 'Quoted', createdAt: '2025-01-01T00:00:00.000Z' },
              indexedAt: '2025-01-01T00:00:00.000Z',
            },
          },
          media: {
            $type: 'app.bsky.embed.images#view',
            images: [{ thumb: 'https://img/t.jpg', fullsize: 'https://img/f.jpg', alt: '' }],
          },
        },
      },
    }));
    expect(result.post.embed?.$type).toBe('app.bsky.embed.recordWithMedia#view');
  });

  it('handles video embeds with nested video object', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.video#view',
          video: {
            cid: 'bafyvid',
            playlist: 'https://video.bsky.app/playlist.m3u8',
            thumbnail: 'https://video.bsky.app/thumb.jpg',
          },
        },
      },
    }));
    expect(result.post.embed?.$type).toBe('app.bsky.embed.video#view');
  });

  it('handles video embeds with flat structure (no video wrapper)', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.video#view',
          cid: 'bafyvid',
          playlist: 'https://video.bsky.app/playlist.m3u8',
          thumbnail: 'https://video.bsky.app/thumb.jpg',
        },
      },
    }));
    expect(result.post.embed?.$type).toBe('app.bsky.embed.video#view');
  });

  it('handles video embeds with missing video data', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.video#view',
        },
      },
    }));
    expect(result.post.embed).toBeUndefined();
  });

  it('handles post with no embed', () => {
    const result = serializeFeedViewPost(makeFeedViewPost());
    expect(result.post.embed).toBeUndefined();
  });

  it('serializes facets', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        record: {
          text: 'Hello @alice.bsky.social',
          createdAt: '2025-01-01T00:00:00.000Z',
          facets: [{
            index: { byteStart: 6, byteEnd: 24 },
            features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:alice' }],
          }],
        },
      },
    }));
    expect(result.post.record.facets).toHaveLength(1);
    expect(result.post.record.facets![0].features[0].$type).toBe('app.bsky.richtext.facet#mention');
  });

  it('serializes repost reason', () => {
    const result = serializeFeedViewPost({
      post: makePost(),
      reason: {
        $type: 'app.bsky.feed.defs#reasonRepost',
        by: makeAuthor({ handle: 'reposter.bsky.social' }),
        indexedAt: '2025-01-01T00:00:00.000Z',
      },
    });
    expect(result.reason?.$type).toBe('app.bsky.feed.defs#reasonRepost');
    expect(result.reason?.by.handle).toBe('reposter.bsky.social');
  });

  it('handles unknown embed types gracefully', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.unknown#view',
          data: 'something',
        },
      },
    }));
    expect(result.post.embed).toBeUndefined();
  });

  it('handles image embed with missing images array', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.images#view',
        },
      },
    }));
    expect(result.post.embed).toBeUndefined();
  });

  it('handles external embed with missing external object', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        embed: {
          $type: 'app.bsky.embed.external#view',
        },
      },
    }));
    expect(result.post.embed).toBeUndefined();
  });

  it('handles malformed facets gracefully', () => {
    const result = serializeFeedViewPost(makeFeedViewPost({
      post: {
        record: {
          text: 'test',
          createdAt: '2025-01-01T00:00:00.000Z',
          facets: [
            null,
            { index: null, features: [] },
            { index: { byteStart: 0, byteEnd: 4 }, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'test' }] },
          ],
        },
      },
    }));
    expect(result.post.record.facets).toHaveLength(1);
  });

  it('handles reply with missing parent/root', () => {
    const result = serializeFeedViewPost({
      post: makePost(),
      reply: { parent: null, root: null },
    } as any);
    expect(result.reply).toBeUndefined();
  });

  it('handles repost reason with missing by', () => {
    const result = serializeFeedViewPost({
      post: makePost(),
      reason: {
        $type: 'app.bsky.feed.defs#reasonRepost',
        indexedAt: '2025-01-01T00:00:00.000Z',
      },
    } as any);
    expect(result.reason).toBeUndefined();
  });
});

describe('serializeFeedPosts', () => {
  it('serializes an array of posts', () => {
    const posts = [makeFeedViewPost(), makeFeedViewPost()];
    const result = serializeFeedPosts(posts as any);
    expect(result).toHaveLength(2);
  });

  it('handles empty array', () => {
    const result = serializeFeedPosts([]);
    expect(result).toHaveLength(0);
  });

  it('filters out posts with missing uri', () => {
    const posts = [
      makeFeedViewPost(),
      { post: { cid: 'abc' } },
      null,
      makeFeedViewPost(),
    ];
    const result = serializeFeedPosts(posts as any);
    expect(result).toHaveLength(2);
  });
});
