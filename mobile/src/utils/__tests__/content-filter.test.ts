jest.mock('@atproto/api', () => ({}));

import type { MutedWord } from '../../services/preferences';

// ─── Factory helpers ──────────────────────────────────────

function makeMutedWord(value: string, overrides: Partial<MutedWord> = {}): MutedWord {
  return {
    id: Math.random().toString(36).slice(2),
    value,
    duration: 'forever',
    appliesTo: 'all',
    ...overrides,
  };
}

function makePost(text: string, overrides: any = {}): any {
  return {
    post: {
      uri: 'at://test/post/1',
      cid: 'bafytest',
      author: { did: 'did:plc:test', handle: 'test.bsky.social' },
      record: { text, createdAt: new Date().toISOString(), ...overrides.record },
      embed: overrides.embed || undefined,
      indexedAt: new Date().toISOString(),
      labels: [],
    },
    ...overrides,
  };
}

function makeNotification(reason: string, text?: string, overrides: any = {}): any {
  return {
    uri: 'at://test/notification/1',
    cid: 'bafynotif',
    reason,
    author: { did: 'did:plc:notifier', handle: 'notifier.bsky.social' },
    record: text ? { text, createdAt: new Date().toISOString(), ...overrides.record } : undefined,
    indexedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────

let contentFilter: typeof import('../content-filter');

beforeEach(() => {
  jest.resetModules();
  contentFilter = require('../content-filter');
});

// ─── calculateExpirationTime ──────────────────────────────

describe('calculateExpirationTime', () => {
  it('returns undefined for "forever"', () => {
    expect(contentFilter.calculateExpirationTime('forever')).toBeUndefined();
  });

  it('returns undefined for undefined/falsy duration', () => {
    expect(contentFilter.calculateExpirationTime(undefined)).toBeUndefined();
  });

  it('returns ~24 hours from now for "24h"', () => {
    const before = Date.now();
    const result = contentFilter.calculateExpirationTime('24h')!;
    const after = Date.now();
    const expected = 24 * 60 * 60 * 1000;
    expect(result).toBeGreaterThanOrEqual(before + expected);
    expect(result).toBeLessThanOrEqual(after + expected);
  });

  it('returns ~7 days from now for "7d"', () => {
    const before = Date.now();
    const result = contentFilter.calculateExpirationTime('7d')!;
    const after = Date.now();
    const expected = 7 * 24 * 60 * 60 * 1000;
    expect(result).toBeGreaterThanOrEqual(before + expected);
    expect(result).toBeLessThanOrEqual(after + expected);
  });

  it('returns ~30 days from now for "30d"', () => {
    const before = Date.now();
    const result = contentFilter.calculateExpirationTime('30d')!;
    const after = Date.now();
    const expected = 30 * 24 * 60 * 60 * 1000;
    expect(result).toBeGreaterThanOrEqual(before + expected);
    expect(result).toBeLessThanOrEqual(after + expected);
  });
});

// ─── Word matching (isPostMuted) ──────────────────────────

describe('isPostMuted - word matching', () => {
  it('returns false when mutedWords is empty', () => {
    const post = makePost('anything here');
    expect(contentFilter.isPostMuted(post, [])).toBe(false);
  });

  it('matches exact word with word boundary', () => {
    const post = makePost('this is a test post');
    const words = [makeMutedWord('test')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });

  it('does NOT match partial words (word boundary enforcement)', () => {
    const postTesting = makePost('I was testing the app');
    const postContest = makePost('enter the contest now');
    const words = [makeMutedWord('test')];
    expect(contentFilter.isPostMuted(postTesting, words)).toBe(false);
    expect(contentFilter.isPostMuted(postContest, words)).toBe(false);
  });

  it('matches phrase as substring', () => {
    const post = makePost('this bad phrase here is problematic');
    const words = [makeMutedWord('bad phrase')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });

  it('matches hashtag with # prefix', () => {
    const post = makePost('#politics are wild today');
    const words = [makeMutedWord('#politics')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });

  it('hashtag muted word does not match without # prefix in post', () => {
    const post = makePost('I love politics discussions');
    const words = [makeMutedWord('#politics')];
    expect(contentFilter.isPostMuted(post, words)).toBe(false);
  });

  it('matches case-insensitively', () => {
    const post = makePost('This has SPOILER content');
    const words = [makeMutedWord('spoiler')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });

  it('matches when any one of multiple muted words is present', () => {
    const post = makePost('a totally normal post about cats');
    const words = [makeMutedWord('dogs'), makeMutedWord('cats'), makeMutedWord('birds')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });
});

// ─── Post text extraction ─────────────────────────────────

describe('isPostMuted - post text extraction', () => {
  it('checks record.text', () => {
    const post = makePost('contains the forbidden word');
    const words = [makeMutedWord('forbidden')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });

  it('checks image alt text in record.embed.images', () => {
    const post = makePost('a nice photo', {
      record: {
        embed: {
          images: [
            { alt: 'a forbidden image description' },
            { alt: 'a normal caption' },
          ],
        },
      },
    });
    const words = [makeMutedWord('forbidden')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });

  it('checks quoted post text in post.embed.record.value.text', () => {
    const post = makePost('quoting this', {
      embed: {
        record: {
          value: { text: 'the original post with forbidden content' },
        },
      },
    });
    const words = [makeMutedWord('forbidden')];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });
});

// ─── Feed-specific filtering ──────────────────────────────

describe('isPostMuted - feed-specific filtering', () => {
  it('skips appliesTo="home" muted word when feedType is "other"', () => {
    const post = makePost('contains spoiler info');
    const words = [makeMutedWord('spoiler', { appliesTo: 'home' })];
    expect(contentFilter.isPostMuted(post, words, 'other')).toBe(false);
  });

  it('applies appliesTo="home" muted word when feedType is "home"', () => {
    const post = makePost('contains spoiler info');
    const words = [makeMutedWord('spoiler', { appliesTo: 'home' })];
    expect(contentFilter.isPostMuted(post, words, 'home')).toBe(true);
  });

  it('applies appliesTo="all" muted word regardless of feedType', () => {
    const post = makePost('contains spoiler info');
    const words = [makeMutedWord('spoiler', { appliesTo: 'all' })];
    expect(contentFilter.isPostMuted(post, words, 'home')).toBe(true);
    expect(contentFilter.isPostMuted(post, words, 'other')).toBe(true);
  });
});

// ─── Expiration ───────────────────────────────────────────

describe('isPostMuted - expiration', () => {
  it('does not filter when muted word has expired', () => {
    const post = makePost('this contains badword content');
    const words = [makeMutedWord('badword', {
      duration: '24h',
      expiresAt: Date.now() - 1000,
    })];
    expect(contentFilter.isPostMuted(post, words)).toBe(false);
  });

  it('filters when muted word has not yet expired', () => {
    const post = makePost('this contains badword content');
    const words = [makeMutedWord('badword', {
      duration: '24h',
      expiresAt: Date.now() + 60 * 60 * 1000,
    })];
    expect(contentFilter.isPostMuted(post, words)).toBe(true);
  });
});

// ─── getActiveMutedWords ──────────────────────────────────

describe('getActiveMutedWords', () => {
  it('filters out expired words', () => {
    const expired = makeMutedWord('old', {
      duration: '24h',
      expiresAt: Date.now() - 1000,
    });
    const active = makeMutedWord('current', {
      duration: '7d',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    const result = contentFilter.getActiveMutedWords([expired, active]);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('current');
  });

  it('keeps non-expired and forever words', () => {
    const forever = makeMutedWord('permanent', { duration: 'forever' });
    const active = makeMutedWord('temporary', {
      duration: '30d',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    const result = contentFilter.getActiveMutedWords([forever, active]);
    expect(result).toHaveLength(2);
  });
});

// ─── Notification filtering ──────────────────────────────

describe('isNotificationMuted', () => {
  it('never mutes follow notifications', () => {
    const notification = makeNotification('follow', 'badword');
    const words = [makeMutedWord('badword')];
    expect(contentFilter.isNotificationMuted(notification, words)).toBe(false);
  });

  it('mutes reply notification containing a muted word', () => {
    const notification = makeNotification('reply', 'this has a badword in it');
    const words = [makeMutedWord('badword')];
    expect(contentFilter.isNotificationMuted(notification, words)).toBe(true);
  });

  it('mutes mention notification containing a muted word', () => {
    const notification = makeNotification('mention', 'hey check this badword out');
    const words = [makeMutedWord('badword')];
    expect(contentFilter.isNotificationMuted(notification, words)).toBe(true);
  });

  it('does not mute notification without matching text', () => {
    const notification = makeNotification('reply', 'a perfectly normal reply');
    const words = [makeMutedWord('badword')];
    expect(contentFilter.isNotificationMuted(notification, words)).toBe(false);
  });
});

// ─── Batch operations ─────────────────────────────────────

describe('filterMutedPosts', () => {
  it('filters matching posts from array', () => {
    const posts = [
      makePost('normal post about code'),
      makePost('this post contains badword'),
      makePost('another clean post'),
    ];
    const words = [makeMutedWord('badword')];
    const result = contentFilter.filterMutedPosts(posts, words);
    expect(result).toHaveLength(2);
    expect((result[0].post.record as any).text).toBe('normal post about code');
    expect((result[1].post.record as any).text).toBe('another clean post');
  });

  it('returns all items unchanged when mutedWords is empty', () => {
    const posts = [makePost('post one'), makePost('post two')];
    const result = contentFilter.filterMutedPosts(posts, []);
    expect(result).toHaveLength(2);
  });
});

describe('filterMutedNotifications', () => {
  it('filters matching notifications from array', () => {
    const notifications = [
      makeNotification('reply', 'normal reply'),
      makeNotification('mention', 'this has badword'),
      makeNotification('follow'),
    ];
    const words = [makeMutedWord('badword')];
    const result = contentFilter.filterMutedNotifications(notifications, words);
    expect(result).toHaveLength(2);
  });

  it('returns all items unchanged when mutedWords is empty', () => {
    const notifications = [
      makeNotification('reply', 'any text'),
      makeNotification('mention', 'other text'),
    ];
    const result = contentFilter.filterMutedNotifications(notifications, []);
    expect(result).toHaveLength(2);
  });
});
