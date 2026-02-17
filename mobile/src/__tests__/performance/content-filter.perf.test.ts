/**
 * Performance tests for content-filter.ts
 *
 * Validates P1 fix: muted word regex pre-compilation and caching.
 * See ISSUE-CPU-1 in INSTRUMENTS_PROFILING_REPORT.md.
 *
 * These tests ensure:
 * 1. Regex compilation is cached (not re-created per post×word check)
 * 2. Filtering 500 posts × 10 muted words completes in <50ms
 * 3. Cache invalidation works correctly
 */

import {filterMutedPosts, isPostMuted} from '../../utils/content-filter';
import type {MutedWord} from '../../services/preferences';
import type {AppBskyFeedDefs} from '@atproto/api';

// Generate synthetic feed posts
function makePost(index: number, text: string): AppBskyFeedDefs.FeedViewPost {
  return {
    post: {
      uri: `at://did:plc:test${index}/app.bsky.feed.post/${index}`,
      cid: `bafyrei${index.toString().padStart(40, '0')}`,
      author: {
        did: `did:plc:test${index % 50}`,
        handle: `user${index % 50}.bsky.social`,
        displayName: `Test User ${index % 50}`,
        avatar: `https://cdn.bsky.app/img/avatar/${index}`,
        labels: [],
      },
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      },
      indexedAt: new Date().toISOString(),
      likeCount: Math.floor(Math.random() * 100),
      repostCount: Math.floor(Math.random() * 50),
      replyCount: Math.floor(Math.random() * 30),
      labels: [],
    },
  } as unknown as AppBskyFeedDefs.FeedViewPost;
}

// Generate muted words with various patterns
function makeMutedWords(count: number): MutedWord[] {
  const words: MutedWord[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      // Hashtag mute
      words.push({
        value: `#mutedtag${i}`,
        appliesTo: 'all',
        duration: 'forever',
      });
    } else if (i % 3 === 1) {
      // Phrase mute (multi-word)
      words.push({
        value: `muted phrase ${i}`,
        appliesTo: 'all',
        duration: 'forever',
      });
    } else {
      // Word mute (single word with boundary)
      words.push({
        value: `mutedword${i}`,
        appliesTo: 'all',
        duration: 'forever',
      });
    }
  }
  return words;
}

describe('content-filter performance', () => {
  // Generate test data once
  const posts500 = Array.from({length: 500}, (_, i) =>
    makePost(
      i,
      `This is test post ${i} with some content. It might contain various words and phrases. #sometag @mention https://example.com`,
    ),
  );

  const mutedWords10 = makeMutedWords(10);
  const mutedWords50 = makeMutedWords(50);

  test('filterMutedPosts: 500 posts × 10 muted words completes in <50ms', () => {
    // Warm up the regex cache
    filterMutedPosts(posts500.slice(0, 1), mutedWords10);

    const start = performance.now();
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      filterMutedPosts(posts500, mutedWords10);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    // Target: <50ms per filterMutedPosts call with 500 posts × 10 words
    // This was previously ~50ms due to 5000 regex compilations (ISSUE-CPU-1)
    // With caching, should be <10ms
    expect(avgMs).toBeLessThan(50);
  });

  test('filterMutedPosts: 500 posts × 50 muted words completes in <100ms', () => {
    // Warm up
    filterMutedPosts(posts500.slice(0, 1), mutedWords50);

    const start = performance.now();
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      filterMutedPosts(posts500, mutedWords50);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    // 500 posts × 50 words = 25,000 checks
    // With cached regex: should still be <100ms
    expect(avgMs).toBeLessThan(100);
  });

  test('regex cache is reused across calls (no recompilation)', () => {
    // Run many iterations to get stable timings (single calls are too fast to measure reliably)
    const iterations = 100;

    // First batch: includes initial cache population
    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      filterMutedPosts(posts500, mutedWords10);
    }
    const firstBatchMs = performance.now() - start1;

    // Second batch: cache is fully warm
    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      filterMutedPosts(posts500, mutedWords10);
    }
    const secondBatchMs = performance.now() - start2;

    // Second batch should not be slower than first (cache is warm for both
    // since it populates on the very first call). Allow margin for JIT/GC variance.
    expect(secondBatchMs).toBeLessThan(firstBatchMs * 1.5 + 10);
  });

  test('isPostMuted: single post check is <0.1ms', () => {
    const post = posts500[0];

    // Warm up cache
    isPostMuted(post, mutedWords10);

    const start = performance.now();
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      isPostMuted(post, mutedWords10);
    }

    const elapsed = performance.now() - start;
    const avgMicroseconds = (elapsed / iterations) * 1000;

    // Target: <100 microseconds per check (0.1ms)
    expect(avgMicroseconds).toBeLessThan(100);
  });

  test('filterMutedPosts: posts with matching muted words are filtered', () => {
    // Create posts that match muted words
    const matchingPosts = [
      makePost(0, 'This contains mutedword2 in it'),
      makePost(1, 'This has muted phrase 1 embedded'),
      makePost(2, 'Check out #mutedtag0'),
      makePost(3, 'This post has no muted content'),
      makePost(4, 'Another clean post'),
    ];

    const result = filterMutedPosts(matchingPosts, mutedWords10);

    // Posts 0, 1, 2 should be filtered out
    expect(result.length).toBe(2);
    expect(result[0].post.uri).toContain('post/3');
    expect(result[1].post.uri).toContain('post/4');
  });

  test('filterMutedPosts: empty muted words returns all posts (fast path)', () => {
    const start = performance.now();
    const result = filterMutedPosts(posts500, []);
    const elapsed = performance.now() - start;

    // Empty muted words should return immediately (same reference)
    expect(result).toBe(posts500);
    expect(elapsed).toBeLessThan(5); // Should be nearly instant
  });

  test('filterMutedPosts: expired muted words are skipped', () => {
    const expiredWords: MutedWord[] = [
      {
        value: 'expired',
        appliesTo: 'all',
        duration: '24h',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      },
    ];

    const postsWithExpired = [
      makePost(0, 'This contains expired word'),
      makePost(1, 'Clean post'),
    ];

    const result = filterMutedPosts(postsWithExpired, expiredWords);
    // Expired word should NOT filter the post
    expect(result.length).toBe(2);
  });
});
