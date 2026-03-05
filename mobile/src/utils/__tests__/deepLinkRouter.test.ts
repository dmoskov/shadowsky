import {parseURL, resolveRoute, resolveDeepLink, ParsedURL} from '../deepLinkRouter';

// ─── parseURL ────────────────────────────────────────────

describe('parseURL', () => {
  it('parses custom scheme URL into hostname and path', () => {
    const result = parseURL('shadowsky://profile/user');
    expect(result.hostname).toBe('profile');
    expect(result.path).toBe('user');
    expect(result.queryParams).toEqual({});
  });

  it('parses HTTPS bsky.app URL', () => {
    const result = parseURL('https://bsky.app/profile/user.bsky.social');
    expect(result.hostname).toBe('bsky.app');
    expect(result.path).toBe('profile/user.bsky.social');
    expect(result.queryParams).toEqual({});
  });

  it('returns nulls for malformed URL', () => {
    const result = parseURL('not a url at all %%%');
    expect(result.hostname).toBeNull();
    expect(result.path).toBeNull();
    expect(result.queryParams).toEqual({});
  });

  it('parses query params correctly', () => {
    const result = parseURL('https://bsky.app/search?q=hello+world&lang=en');
    expect(result.queryParams.q).toBe('hello world');
    expect(result.queryParams.lang).toBe('en');
  });

  it('handles shadowsky:// with no path', () => {
    const result = parseURL('shadowsky://compose');
    expect(result.hostname).toBe('compose');
    expect(result.path).toBeNull();
  });

  it('handles shadowsky:// with path and query params', () => {
    const result = parseURL('shadowsky://compose/draft?url=https%3A%2F%2Fexample.com&text=hi');
    expect(result.hostname).toBe('compose');
    expect(result.path).toBe('draft');
    expect(result.queryParams.url).toBe('https://example.com');
    expect(result.queryParams.text).toBe('hi');
  });
});

// ─── resolveRoute ────────────────────────────────────────

describe('resolveRoute', () => {
  function makeParsed(
    hostname: string | null,
    path: string | null = null,
    queryParams: Record<string, string | undefined> = {},
  ): ParsedURL {
    return {hostname, path, queryParams};
  }

  it('returns null when hostname is null', () => {
    expect(resolveRoute(makeParsed(null))).toBeNull();
  });

  // ── OAuth ──

  it('routes oauth-callback hostname', () => {
    const route = resolveRoute(makeParsed('oauth-callback', null, {code: 'abc', state: 'xyz'}));
    expect(route).toBe('/(auth)/oauth-callback?code=abc&state=xyz');
  });

  it('routes oauth hostname with callback path', () => {
    const route = resolveRoute(makeParsed('oauth', 'callback', {code: 'c1', state: 's1'}));
    expect(route).toBe('/(auth)/oauth-callback?code=c1&state=s1');
  });

  it('includes error and iss params in oauth callback', () => {
    const route = resolveRoute(makeParsed('oauth-callback', null, {
      error: 'access_denied',
      iss: 'https://bsky.social',
    }));
    expect(route).toBe(
      '/(auth)/oauth-callback?error=access_denied&iss=https%3A%2F%2Fbsky.social',
    );
  });

  it('omits undefined oauth params', () => {
    const route = resolveRoute(makeParsed('oauth-callback'));
    expect(route).toBe('/(auth)/oauth-callback?');
  });

  // ── Compose ──

  it('routes compose deep link with url and text params', () => {
    const route = resolveRoute(makeParsed('compose', null, {
      url: 'https://example.com',
      text: 'Check this out',
    }));
    expect(route).toContain('/(app)/compose?');
    expect(route).toContain('url=https%3A%2F%2Fexample.com');
    expect(route).toContain('text=Check+this+out');
  });

  it('routes compose deep link with hasImages param', () => {
    const route = resolveRoute(makeParsed('compose', null, {hasImages: '1'}));
    expect(route).toBe('/(app)/compose?hasImages=true');
  });

  it('routes compose deep link with no params', () => {
    const route = resolveRoute(makeParsed('compose'));
    expect(route).toBe('/(app)/compose?');
  });

  // ── Profile via custom scheme ──

  it('routes profile deep link via custom scheme', () => {
    const route = resolveRoute(makeParsed('profile', 'user.bsky.social'));
    expect(route).toBe('/(app)/(tabs)/(home)/profile/user.bsky.social');
  });

  it('returns home route for profile hostname with no path', () => {
    const route = resolveRoute(makeParsed('profile'));
    expect(route).toBe('/(app)/(tabs)/(home)');
  });

  // ── Post via custom scheme ──

  it('routes post deep link via custom scheme', () => {
    const route = resolveRoute(makeParsed('post', 'user.bsky.social/3abc123'));
    expect(route).toBe('/(app)/(tabs)/(home)/thread/3abc123?handle=user.bsky.social');
  });

  // ── bsky.app profile URLs ──

  it('routes bsky.app profile URL', () => {
    const route = resolveRoute(makeParsed('bsky.app', 'profile/alice.bsky.social'));
    expect(route).toBe('/(app)/(tabs)/(home)/profile/alice.bsky.social');
  });

  // ── bsky.app post URLs ──

  it('routes bsky.app post URL', () => {
    const route = resolveRoute(makeParsed('bsky.app', 'profile/alice.bsky.social/post/3k2abc'));
    expect(route).toBe('/(app)/(tabs)/(home)/thread/3k2abc?handle=alice.bsky.social');
  });

  // ── staging.bsky.app ──

  it('routes staging.bsky.app URLs the same as bsky.app', () => {
    const route = resolveRoute(makeParsed('staging.bsky.app', 'profile/bob.bsky.social'));
    expect(route).toBe('/(app)/(tabs)/(home)/profile/bob.bsky.social');
  });

  // ── shadowsky.io ──

  it('routes shadowsky.io URLs the same as bsky.app', () => {
    const route = resolveRoute(makeParsed('shadowsky.io', 'profile/carol.bsky.social/post/xyz'));
    expect(route).toBe('/(app)/(tabs)/(home)/thread/xyz?handle=carol.bsky.social');
  });

  // ── main.shadowsky.io ──

  it('routes main.shadowsky.io URLs the same as bsky.app', () => {
    const route = resolveRoute(makeParsed('main.shadowsky.io', 'profile/dan.bsky.social'));
    expect(route).toBe('/(app)/(tabs)/(home)/profile/dan.bsky.social');
  });

  // ── Search ──

  it('routes bsky.app search URL with query param', () => {
    const route = resolveRoute(makeParsed('bsky.app', 'search', {q: 'hello world'}));
    expect(route).toBe('/(app)/(tabs)/(search)?query=hello%20world');
  });

  it('routes search when path is null but q param exists', () => {
    const route = resolveRoute(makeParsed('bsky.app', null, {q: 'test'}));
    expect(route).toBe('/(app)/(tabs)/(search)?query=test');
  });

  // ── Feeds ──

  it('routes bsky.app feed URL', () => {
    const feedUri = 'at://did:plc:abc/app.bsky.feed.generator/whats-hot';
    const encoded = encodeURIComponent(feedUri);
    const route = resolveRoute(makeParsed('bsky.app', `feeds/${encoded}`));
    expect(route).toBe(`/(app)/feed/${encodeURIComponent(feedUri)}`);
  });

  // ── Unknown hostname ──

  it('returns home route for unknown hostname', () => {
    const route = resolveRoute(makeParsed('unknown-thing'));
    expect(route).toBe('/(app)/(tabs)/(home)');
  });
});

// ─── resolveDeepLink ─────────────────────────────────────

describe('resolveDeepLink', () => {
  it('returns null for empty string', () => {
    expect(resolveDeepLink('')).toBeNull();
  });

  it('returns null for null-like input', () => {
    // TypeScript would prevent this at compile time, but test runtime safety
    expect(resolveDeepLink(null as unknown as string)).toBeNull();
    expect(resolveDeepLink(undefined as unknown as string)).toBeNull();
  });

  it('parses and routes a full shadowsky:// URL', () => {
    const route = resolveDeepLink('shadowsky://profile/alice.bsky.social');
    expect(route).toBe('/(app)/(tabs)/(home)/profile/alice.bsky.social');
  });

  it('parses and routes a full bsky.app post URL', () => {
    const route = resolveDeepLink('https://bsky.app/profile/bob.bsky.social/post/3k9xyz');
    expect(route).toBe('/(app)/(tabs)/(home)/thread/3k9xyz?handle=bob.bsky.social');
  });

  it('parses and routes a shadowsky:// oauth-callback URL', () => {
    const route = resolveDeepLink('shadowsky://oauth-callback?code=abc&state=def');
    expect(route).toBe('/(auth)/oauth-callback?code=abc&state=def');
  });
});
