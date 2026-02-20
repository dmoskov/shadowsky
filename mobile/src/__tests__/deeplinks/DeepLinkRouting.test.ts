/**
 * DeepLinkRouting.test.ts
 *
 * Tests for the deep link URL routing logic used by +native-intent.tsx.
 * Validates that all supported URL formats (bsky.app, shadowsky.io,
 * shadowsky:// scheme, at:// protocol) route to the correct screens,
 * and that malformed/unknown URLs are handled gracefully without crashing.
 */

import { parseURL, resolveRoute, resolveDeepLink } from "../../utils/deepLinkRouter";

describe("Deep Link Routing", () => {
  // ---------------------------------------------------------------
  // bsky.app profile links
  // ---------------------------------------------------------------
  describe("bsky.app profile links", () => {
    it("routes profile link to profile screen", () => {
      const result = resolveDeepLink("https://bsky.app/profile/alice.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/alice.bsky.social");
    });

    it("routes staging profile link to profile screen", () => {
      const result = resolveDeepLink("https://staging.bsky.app/profile/bob.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/bob.bsky.social");
    });

    it("routes shadowsky.io profile link to profile screen", () => {
      const result = resolveDeepLink("https://shadowsky.io/profile/charlie.test");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/charlie.test");
    });

    it("routes main.shadowsky.io profile link to profile screen", () => {
      const result = resolveDeepLink("https://main.shadowsky.io/profile/dave.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/dave.bsky.social");
    });

    it("handles profile with DID as handle", () => {
      const result = resolveDeepLink("https://bsky.app/profile/did:plc:abc123");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/did:plc:abc123");
    });

    it("handles profile with dots and hyphens in handle", () => {
      const result = resolveDeepLink("https://bsky.app/profile/my-cool.handle.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/my-cool.handle.bsky.social");
    });
  });

  // ---------------------------------------------------------------
  // bsky.app post links
  // ---------------------------------------------------------------
  describe("bsky.app post links", () => {
    it("routes post link to thread screen", () => {
      const result = resolveDeepLink(
        "https://bsky.app/profile/alice.bsky.social/post/3abc123"
      );
      expect(result).toBe("/(app)/(tabs)/(home)/thread/3abc123?handle=alice.bsky.social");
    });

    it("routes staging post link to thread screen", () => {
      const result = resolveDeepLink(
        "https://staging.bsky.app/profile/bob.bsky.social/post/xyz789"
      );
      expect(result).toBe("/(app)/(tabs)/(home)/thread/xyz789?handle=bob.bsky.social");
    });

    it("routes shadowsky.io post link to thread screen", () => {
      const result = resolveDeepLink(
        "https://shadowsky.io/profile/charlie.test/post/rk3y"
      );
      expect(result).toBe("/(app)/(tabs)/(home)/thread/rk3y?handle=charlie.test");
    });

    it("handles post link with DID as handle", () => {
      const result = resolveDeepLink(
        "https://bsky.app/profile/did:plc:abc123/post/post456"
      );
      expect(result).toBe("/(app)/(tabs)/(home)/thread/post456?handle=did:plc:abc123");
    });
  });

  // ---------------------------------------------------------------
  // bsky.app search links
  // ---------------------------------------------------------------
  describe("bsky.app search links", () => {
    it("routes search link to search screen", () => {
      const result = resolveDeepLink("https://bsky.app/search?q=bluesky");
      expect(result).toBe("/(app)/(tabs)/(search)?query=bluesky");
    });

    it("handles search with URL-encoded query", () => {
      const result = resolveDeepLink("https://bsky.app/search?q=hello%20world");
      expect(result).toBe("/(app)/(tabs)/(search)?query=hello%20world");
    });

    it("handles search with special characters", () => {
      const result = resolveDeepLink("https://bsky.app/search?q=%23trending");
      expect(result).toBe("/(app)/(tabs)/(search)?query=%23trending");
    });

    it("handles search with empty query", () => {
      const result = resolveDeepLink("https://bsky.app/search?q=");
      expect(result).toBe("/(app)/(tabs)/(search)?query=");
    });
  });

  // ---------------------------------------------------------------
  // bsky.app feed links
  // ---------------------------------------------------------------
  describe("bsky.app feed links", () => {
    it("routes feed link to feed screen", () => {
      const result = resolveDeepLink("https://bsky.app/feeds/my-feed-uri");
      expect(result).toBe("/(app)/feed/my-feed-uri");
    });

    it("handles URL-encoded feed URI", () => {
      const encodedUri = encodeURIComponent("at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot");
      const result = resolveDeepLink(`https://bsky.app/feeds/${encodedUri}`);
      expect(result).toBe(
        `/(app)/feed/${encodeURIComponent("at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot")}`
      );
    });
  });

  // ---------------------------------------------------------------
  // shadowsky:// scheme — OAuth callback
  // ---------------------------------------------------------------
  describe("OAuth callback links", () => {
    it("routes oauth-callback with code and state", () => {
      const result = resolveDeepLink(
        "shadowsky://oauth-callback?code=abc123&state=xyz789"
      );
      expect(result).toBe("/(auth)/oauth-callback?code=abc123&state=xyz789");
    });

    it("routes oauth/callback path variant", () => {
      const result = resolveDeepLink(
        "shadowsky://oauth/callback?code=def456&state=uvw321"
      );
      expect(result).toBe("/(auth)/oauth-callback?code=def456&state=uvw321");
    });

    it("routes oauth callback with error param", () => {
      const result = resolveDeepLink(
        "shadowsky://oauth-callback?error=access_denied&state=xyz"
      );
      // Params are appended in code/state/error/iss order by resolveRoute
      expect(result).toBe("/(auth)/oauth-callback?state=xyz&error=access_denied");
    });

    it("routes oauth callback with iss param", () => {
      const result = resolveDeepLink(
        "shadowsky://oauth-callback?code=abc&state=xyz&iss=https%3A%2F%2Fexample.com"
      );
      expect(result).toContain("/(auth)/oauth-callback?");
      expect(result).toContain("code=abc");
      expect(result).toContain("state=xyz");
    });
  });

  // ---------------------------------------------------------------
  // shadowsky:// scheme — Compose (Share Extension)
  // ---------------------------------------------------------------
  describe("Compose deep links (Share Extension)", () => {
    it("routes compose with URL", () => {
      const result = resolveDeepLink(
        "shadowsky://compose?url=https%3A%2F%2Fexample.com%2Fpage"
      );
      expect(result).toBe(
        "/(app)/compose?url=https%3A%2F%2Fexample.com%2Fpage"
      );
    });

    it("routes compose with text", () => {
      const result = resolveDeepLink(
        "shadowsky://compose?text=Check%20this%20out"
      );
      expect(result).toBe("/(app)/compose?text=Check+this+out");
    });

    it("routes compose with images flag", () => {
      const result = resolveDeepLink("shadowsky://compose?hasImages=true");
      expect(result).toBe("/(app)/compose?hasImages=true");
    });

    it("routes compose with URL and text together", () => {
      const result = resolveDeepLink(
        "shadowsky://compose?url=https%3A%2F%2Fexample.com&text=cool%20link"
      );
      expect(result).toContain("/(app)/compose?");
      expect(result).toContain("url=https%3A%2F%2Fexample.com");
      expect(result).toContain("text=cool");
    });

    it("routes compose with no params", () => {
      const result = resolveDeepLink("shadowsky://compose");
      expect(result).toBe("/(app)/compose?");
    });
  });

  // ---------------------------------------------------------------
  // shadowsky:// scheme — Spotlight deep links
  // ---------------------------------------------------------------
  describe("Spotlight deep links", () => {
    it("routes profile spotlight link", () => {
      const result = resolveDeepLink("shadowsky://profile/alice.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/alice.bsky.social");
    });

    it("routes post spotlight link", () => {
      const result = resolveDeepLink("shadowsky://post/alice.bsky.social/3abc123");
      expect(result).toBe("/(app)/(tabs)/(home)/thread/3abc123?handle=alice.bsky.social");
    });

    it("routes post spotlight link with DID", () => {
      const result = resolveDeepLink("shadowsky://post/did:plc:abc123/rkey456");
      expect(result).toBe("/(app)/(tabs)/(home)/thread/rkey456?handle=did:plc:abc123");
    });
  });

  // ---------------------------------------------------------------
  // Malformed / edge case URLs — must not crash
  // ---------------------------------------------------------------
  describe("Malformed URLs", () => {
    it("returns default for empty string", () => {
      const result = resolveDeepLink("");
      expect(result).toBeNull();
    });

    it("returns default for random string", () => {
      const result = resolveDeepLink("not-a-url-at-all");
      // parseURL will fail → null hostname → null route
      expect(result).not.toBeUndefined();
    });

    it("returns default for unknown hostname", () => {
      const result = resolveDeepLink("https://example.com/some/path");
      // Unknown host → falls through to default home
      expect(result).toBe("/(app)/(tabs)/(home)");
    });

    it("handles bsky.app with no path", () => {
      const result = resolveDeepLink("https://bsky.app/");
      // No matching path segments → default home
      expect(result).toBe("/(app)/(tabs)/(home)");
    });

    it("handles bsky.app with unknown path", () => {
      const result = resolveDeepLink("https://bsky.app/unknown/path");
      expect(result).toBe("/(app)/(tabs)/(home)");
    });

    it("handles profile link with only /profile (no handle)", () => {
      const result = resolveDeepLink("https://bsky.app/profile");
      // pathSegments = ["profile"], length 1, doesn't match length === 2
      expect(result).toBe("/(app)/(tabs)/(home)");
    });

    it("handles post link with incomplete path", () => {
      const result = resolveDeepLink("https://bsky.app/profile/alice/post");
      // pathSegments = ["profile", "alice", "post"], length 3 ≠ 4
      expect(result).toBe("/(app)/(tabs)/(home)");
    });

    it("handles null/undefined gracefully", () => {
      // @ts-expect-error testing invalid input
      expect(resolveDeepLink(null)).toBeNull();
      // @ts-expect-error testing invalid input
      expect(resolveDeepLink(undefined)).toBeNull();
    });

    it("handles URL with fragments", () => {
      const result = resolveDeepLink("https://bsky.app/profile/alice.bsky.social#section");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/alice.bsky.social");
    });

    it("handles double-encoded URL", () => {
      // The function should at least not crash
      const result = resolveDeepLink(
        "https://bsky.app/profile/alice.bsky.social%252Ftest"
      );
      expect(result).not.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------
  // Special characters in handles
  // ---------------------------------------------------------------
  describe("Special characters in handles", () => {
    it("handles numeric handle", () => {
      const result = resolveDeepLink("https://bsky.app/profile/12345.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/12345.bsky.social");
    });

    it("handles handle with many dots", () => {
      const result = resolveDeepLink("https://bsky.app/profile/a.b.c.d.bsky.social");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/a.b.c.d.bsky.social");
    });

    it("handles custom domain handle", () => {
      const result = resolveDeepLink("https://bsky.app/profile/jay.bsky.team");
      expect(result).toBe("/(app)/(tabs)/(home)/profile/jay.bsky.team");
    });
  });

  // ---------------------------------------------------------------
  // Universal links (https:// → app routes)
  // ---------------------------------------------------------------
  describe("Universal links", () => {
    it("all supported hosts route correctly", () => {
      const hosts = ["bsky.app", "staging.bsky.app", "shadowsky.io", "main.shadowsky.io"];
      for (const host of hosts) {
        const result = resolveDeepLink(`https://${host}/profile/test.user`);
        expect(result).toBe("/(app)/(tabs)/(home)/profile/test.user");
      }
    });

    it("non-supported hosts fall through to default", () => {
      const result = resolveDeepLink("https://notsupported.com/profile/test");
      expect(result).toBe("/(app)/(tabs)/(home)");
    });
  });

  // ---------------------------------------------------------------
  // parseURL unit tests
  // ---------------------------------------------------------------
  describe("parseURL", () => {
    it("parses https URL correctly", () => {
      const parsed = parseURL("https://bsky.app/profile/alice?tab=posts");
      expect(parsed.hostname).toBe("bsky.app");
      expect(parsed.path).toBe("profile/alice");
      expect(parsed.queryParams.tab).toBe("posts");
    });

    it("parses shadowsky:// scheme correctly", () => {
      const parsed = parseURL("shadowsky://compose?url=test");
      expect(parsed.hostname).toBe("compose");
      expect(parsed.queryParams.url).toBe("test");
    });

    it("returns null hostname for invalid URL", () => {
      const parsed = parseURL(":::invalid");
      expect(parsed.hostname).toBeNull();
    });
  });
});
