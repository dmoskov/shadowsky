jest.mock('@atproto/api', () => ({}));

import {
  aggregateNotifications,
  filterNotificationsByType,
  filterProcessedNotifications,
  countNotificationsByType,
  ProcessedNotification,
} from '../notification-aggregator';

// ─── Factory helper ────────────────────────────────────────

function makeNotification(
  reason: string,
  overrides: Record<string, any> = {},
): any {
  return {
    uri: `at://did:plc:test/app.bsky.feed.like/${Date.now()}-${Math.random()}`,
    cid: 'bafytest',
    author: {
      did: `did:plc:${Math.random().toString(36).slice(2)}`,
      handle: 'test.bsky.social',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
    reason,
    reasonSubject:
      overrides.reasonSubject ||
      'at://did:plc:target/app.bsky.feed.post/testpost',
    isRead: false,
    indexedAt: overrides.indexedAt || new Date().toISOString(),
    labels: [],
    ...overrides,
  };
}

function makeNotificationsWithSameTarget(
  reason: string,
  count: number,
  baseTime = Date.now(),
  targetUri = 'at://did:plc:target/app.bsky.feed.post/shared',
): any[] {
  return Array.from({length: count}, (_, i) =>
    makeNotification(reason, {
      reasonSubject: targetUri,
      indexedAt: new Date(baseTime - i * 60_000).toISOString(), // 1 min apart
      author: {
        did: `did:plc:user${i}`,
        handle: `user${i}.bsky.social`,
        displayName: `User ${i}`,
        avatar: `https://example.com/avatar${i}.jpg`,
      },
    }),
  );
}

// ─── aggregateNotifications ────────────────────────────────

describe('aggregateNotifications', () => {
  it('passes a single notification through as type single', () => {
    const notif = makeNotification('like');
    const result = aggregateNotifications([notif]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('single');
    if (result[0].type === 'single') {
      expect(result[0].notification).toBe(notif);
    }
  });

  it('always keeps replies as single (never aggregated)', () => {
    const replies = Array.from({length: 5}, () => makeNotification('reply'));
    const result = aggregateNotifications(replies);
    expect(result).toHaveLength(5);
    result.forEach(r => expect(r.type).toBe('single'));
  });

  it('always keeps mentions as single (never aggregated)', () => {
    const mentions = Array.from({length: 5}, () =>
      makeNotification('mention'),
    );
    const result = aggregateNotifications(mentions);
    expect(result).toHaveLength(5);
    result.forEach(r => expect(r.type).toBe('single'));
  });

  it('aggregates likes by reasonSubject when 3+ within 24h', () => {
    const likes = makeNotificationsWithSameTarget('like', 4);
    const result = aggregateNotifications(likes);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('aggregated');
    if (result[0].type === 'aggregated') {
      expect(result[0].reason).toBe('like');
      expect(result[0].count).toBe(4);
      expect(result[0].users).toHaveLength(4);
      expect(result[0].targetPostUri).toBe(
        'at://did:plc:target/app.bsky.feed.post/shared',
      );
    }
  });

  it('keeps likes below threshold (2) as individual singles', () => {
    const likes = makeNotificationsWithSameTarget('like', 2);
    const result = aggregateNotifications(likes);
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.type).toBe('single'));
  });

  it('aggregates follows when 2+ (lower threshold)', () => {
    const follows = Array.from({length: 2}, (_, i) =>
      makeNotification('follow', {
        indexedAt: new Date(Date.now() - i * 60_000).toISOString(),
        author: {
          did: `did:plc:follower${i}`,
          handle: `follower${i}.bsky.social`,
          displayName: `Follower ${i}`,
          avatar: `https://example.com/follower${i}.jpg`,
        },
      }),
    );
    const result = aggregateNotifications(follows);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('aggregated');
    if (result[0].type === 'aggregated') {
      expect(result[0].reason).toBe('follow');
      expect(result[0].count).toBe(2);
    }
  });

  it('does not cluster likes more than 24h apart', () => {
    const now = Date.now();
    const recentLikes = makeNotificationsWithSameTarget('like', 3, now);
    const oldLikes = makeNotificationsWithSameTarget(
      'like',
      3,
      now - 48 * 60 * 60 * 1000, // 48 hours ago
    );
    const all = [...recentLikes, ...oldLikes];
    const result = aggregateNotifications(all);

    // Should produce two separate aggregated groups (each cluster has 3)
    const aggregated = result.filter(r => r.type === 'aggregated');
    expect(aggregated).toHaveLength(2);
    aggregated.forEach(a => {
      if (a.type === 'aggregated') {
        expect(a.count).toBe(3);
      }
    });
  });

  it('deduplicates users within an aggregated group', () => {
    const now = Date.now();
    const sameAuthor = {
      did: 'did:plc:sameuser',
      handle: 'same.bsky.social',
      displayName: 'Same User',
      avatar: 'https://example.com/same.jpg',
    };
    const likes = Array.from({length: 3}, (_, i) =>
      makeNotification('like', {
        reasonSubject: 'at://did:plc:target/app.bsky.feed.post/shared',
        indexedAt: new Date(now - i * 60_000).toISOString(),
        author: sameAuthor,
      }),
    );
    const result = aggregateNotifications(likes);
    expect(result).toHaveLength(1);
    if (result[0].type === 'aggregated') {
      expect(result[0].count).toBe(3);
      expect(result[0].users).toHaveLength(1); // deduplicated
      expect(result[0].users[0].did).toBe('did:plc:sameuser');
    }
  });

  it('sorts results by timestamp newest first', () => {
    const now = Date.now();
    const oldReply = makeNotification('reply', {
      indexedAt: new Date(now - 100_000).toISOString(),
    });
    const newReply = makeNotification('reply', {
      indexedAt: new Date(now).toISOString(),
    });
    const result = aggregateNotifications([oldReply, newReply]);
    expect(result).toHaveLength(2);
    // Newest should be first
    if (result[0].type === 'single' && result[1].type === 'single') {
      expect(
        new Date(result[0].notification.indexedAt).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(result[1].notification.indexedAt).getTime(),
      );
    }
  });

  it('aggregates reposts by reasonSubject when 3+', () => {
    const reposts = makeNotificationsWithSameTarget('repost', 3);
    const result = aggregateNotifications(reposts);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('aggregated');
    if (result[0].type === 'aggregated') {
      expect(result[0].reason).toBe('repost');
      expect(result[0].count).toBe(3);
    }
  });

  it('groups like-via-repost separately from regular likes', () => {
    const now = Date.now();
    const target = 'at://did:plc:target/app.bsky.feed.post/shared';
    const likes = makeNotificationsWithSameTarget('like', 3, now, target);
    const viaReposts = Array.from({length: 3}, (_, i) =>
      makeNotification('like-via-repost', {
        reasonSubject: target,
        indexedAt: new Date(now - i * 60_000).toISOString(),
        author: {
          did: `did:plc:via${i}`,
          handle: `via${i}.bsky.social`,
          displayName: `Via User ${i}`,
          avatar: `https://example.com/via${i}.jpg`,
        },
      }),
    );
    const result = aggregateNotifications([...likes, ...viaReposts]);
    const aggregated = result.filter(
      r => r.type === 'aggregated',
    ) as ProcessedNotification[];
    // Should be two separate aggregated groups
    expect(aggregated).toHaveLength(2);
    const reasons = aggregated.map(a =>
      a.type === 'aggregated' ? a.reason : '',
    );
    expect(reasons).toContain('like');
    expect(reasons).toContain('like');
  });

  it('returns empty array for empty input', () => {
    const result = aggregateNotifications([]);
    expect(result).toHaveLength(0);
  });
});

// ─── filterNotificationsByType ─────────────────────────────

describe('filterNotificationsByType', () => {
  const notifications = [
    makeNotification('like'),
    makeNotification('like-via-repost'),
    makeNotification('repost'),
    makeNotification('repost-via-repost'),
    makeNotification('reply'),
    makeNotification('follow'),
    makeNotification('starterpack-joined'),
    makeNotification('mention'),
    makeNotification('quote'),
  ];

  it("'all' returns everything", () => {
    const result = filterNotificationsByType(notifications, 'all');
    expect(result).toHaveLength(notifications.length);
  });

  it("'likes' returns like and like-via-repost", () => {
    const result = filterNotificationsByType(notifications, 'likes');
    expect(result).toHaveLength(2);
    result.forEach(n =>
      expect(['like', 'like-via-repost']).toContain(n.reason),
    );
  });

  it("'reposts' returns repost and repost-via-repost", () => {
    const result = filterNotificationsByType(notifications, 'reposts');
    expect(result).toHaveLength(2);
    result.forEach(n =>
      expect(['repost', 'repost-via-repost']).toContain(n.reason),
    );
  });

  it("'replies' returns reply", () => {
    const result = filterNotificationsByType(notifications, 'replies');
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('reply');
  });

  it("'follows' returns follow and starterpack-joined", () => {
    const result = filterNotificationsByType(notifications, 'follows');
    expect(result).toHaveLength(2);
    result.forEach(n =>
      expect(['follow', 'starterpack-joined']).toContain(n.reason),
    );
  });

  it("'mentions' returns mention", () => {
    const result = filterNotificationsByType(notifications, 'mentions');
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('mention');
  });

  it("'quotes' returns quote", () => {
    const result = filterNotificationsByType(notifications, 'quotes');
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('quote');
  });
});

// ─── filterProcessedNotifications ──────────────────────────

describe('filterProcessedNotifications', () => {
  const now = Date.now();
  const processed: ProcessedNotification[] = [
    {
      type: 'aggregated',
      reason: 'like',
      count: 5,
      users: [{did: 'did:plc:a', handle: 'a.bsky.social'}],
      latestTimestamp: new Date(now).toISOString(),
      notifications: makeNotificationsWithSameTarget('like', 5, now),
      targetPostUri: 'at://did:plc:target/app.bsky.feed.post/post1',
    },
    {
      type: 'single',
      notification: makeNotification('reply', {
        indexedAt: new Date(now - 1000).toISOString(),
      }),
    },
    {
      type: 'single',
      notification: makeNotification('mention', {
        indexedAt: new Date(now - 2000).toISOString(),
      }),
    },
    {
      type: 'aggregated',
      reason: 'follow',
      count: 3,
      users: [
        {did: 'did:plc:b', handle: 'b.bsky.social'},
        {did: 'did:plc:c', handle: 'c.bsky.social'},
      ],
      latestTimestamp: new Date(now - 3000).toISOString(),
      notifications: [],
    },
  ];

  it("'all' returns everything", () => {
    const result = filterProcessedNotifications(processed, 'all');
    expect(result).toHaveLength(processed.length);
  });

  it('filters aggregated notifications by reason', () => {
    const result = filterProcessedNotifications(processed, 'likes');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('aggregated');
    if (result[0].type === 'aggregated') {
      expect(result[0].reason).toBe('like');
    }
  });

  it('filters single notifications by reason', () => {
    const result = filterProcessedNotifications(processed, 'replies');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('single');
    if (result[0].type === 'single') {
      expect(result[0].notification.reason).toBe('reply');
    }
  });

  it('filters follows (includes aggregated follow group)', () => {
    const result = filterProcessedNotifications(processed, 'follows');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('aggregated');
    if (result[0].type === 'aggregated') {
      expect(result[0].reason).toBe('follow');
    }
  });

  it('returns empty when no notifications match filter', () => {
    const result = filterProcessedNotifications(processed, 'quotes');
    expect(result).toHaveLength(0);
  });
});

// ─── countNotificationsByType ──────────────────────────────

describe('countNotificationsByType', () => {
  it('counts all types correctly', () => {
    const notifications = [
      makeNotification('like'),
      makeNotification('like'),
      makeNotification('like-via-repost'),
      makeNotification('repost'),
      makeNotification('repost-via-repost'),
      makeNotification('reply'),
      makeNotification('reply'),
      makeNotification('reply'),
      makeNotification('follow'),
      makeNotification('starterpack-joined'),
      makeNotification('mention'),
      makeNotification('quote'),
      makeNotification('quote'),
    ];
    const counts = countNotificationsByType(notifications);
    expect(counts.all).toBe(13);
    expect(counts.likes).toBe(3); // 2 like + 1 like-via-repost
    expect(counts.reposts).toBe(2); // 1 repost + 1 repost-via-repost
    expect(counts.replies).toBe(3);
    expect(counts.follows).toBe(2); // 1 follow + 1 starterpack-joined
    expect(counts.mentions).toBe(1);
    expect(counts.quotes).toBe(2);
  });

  it('returns all zeros for empty array', () => {
    const counts = countNotificationsByType([]);
    expect(counts.all).toBe(0);
    expect(counts.likes).toBe(0);
    expect(counts.reposts).toBe(0);
    expect(counts.replies).toBe(0);
    expect(counts.follows).toBe(0);
    expect(counts.mentions).toBe(0);
    expect(counts.quotes).toBe(0);
  });
});
