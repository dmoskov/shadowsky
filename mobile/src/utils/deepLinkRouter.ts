/**
 * Deep link URL routing logic extracted from +native-intent.tsx
 * for testability. Parses incoming URLs and returns the internal
 * route path the app should navigate to.
 *
 * Returns null if the URL cannot be matched to any known route.
 */

export interface ParsedURL {
  hostname: string | null;
  path: string | null;
  queryParams: Record<string, string | undefined>;
}

/**
 * Parse a raw URL string into hostname, path, and query params.
 * Mirrors the behavior of Linking.parse() from expo-linking.
 */
export function parseURL(url: string): ParsedURL {
  try {
    // Handle custom scheme URLs (shadowsky://...)
    let normalized = url;
    if (url.startsWith("shadowsky://")) {
      normalized = "https://" + url.substring("shadowsky://".length);
    }

    const parsed = new URL(normalized);
    const hostname = url.startsWith("shadowsky://")
      ? parsed.hostname || parsed.pathname.split("/").filter(Boolean)[0] || null
      : parsed.hostname;

    // For custom scheme, the "path" is everything after the hostname
    let path: string | null;
    if (url.startsWith("shadowsky://")) {
      const afterScheme = url.substring("shadowsky://".length);
      const slashIndex = afterScheme.indexOf("/");
      path = slashIndex >= 0 ? afterScheme.substring(slashIndex + 1).split("?")[0] : null;
    } else {
      path = parsed.pathname.length > 1 ? parsed.pathname.substring(1) : null;
    }

    const queryParams: Record<string, string | undefined> = {};
    parsed.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    return { hostname, path, queryParams };
  } catch {
    return { hostname: null, path: null, queryParams: {} };
  }
}

/**
 * Given a parsed URL, determine the internal app route to navigate to.
 * Returns the route string, or null if the URL doesn't match any pattern.
 *
 * This mirrors the routing logic in app/+native-intent.tsx.
 */
export function resolveRoute(parsed: ParsedURL): string | null {
  const { hostname, path, queryParams } = parsed;

  if (!hostname) return null;

  // Handle OAuth callback (shadowsky://oauth-callback or shadowsky://oauth/callback)
  if (
    hostname === "oauth-callback" ||
    (hostname === "oauth" && path === "callback")
  ) {
    const params = new URLSearchParams();
    if (queryParams?.code) params.append("code", queryParams.code);
    if (queryParams?.state) params.append("state", queryParams.state);
    if (queryParams?.error) params.append("error", queryParams.error);
    if (queryParams?.iss) params.append("iss", queryParams.iss);
    return `/(auth)/oauth-callback?${params.toString()}`;
  }

  // Handle compose deep link from Share Extension (shadowsky://compose)
  if (hostname === "compose") {
    const params = new URLSearchParams();
    if (queryParams?.url) params.append("url", queryParams.url);
    if (queryParams?.text) params.append("text", queryParams.text);
    if (queryParams?.hasImages) params.append("hasImages", "true");
    return `/(app)/compose?${params.toString()}`;
  }

  // Handle Spotlight deep links (shadowsky://profile/{handle})
  if (hostname === "profile" && path) {
    const handle = path.split("/").filter(Boolean)[0];
    if (handle) {
      return `/(app)/(tabs)/(home)/profile/${handle}`;
    }
  }

  // Handle Spotlight deep links (shadowsky://post/{handle}/{rkey})
  if (hostname === "post" && path) {
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const handle = segments[0];
      const rkey = segments[1];
      return `/(app)/(tabs)/(home)/thread/${rkey}?handle=${handle}`;
    }
  }

  // Handle bsky.app / asphodel.is / shadowsky.io URLs
  if (
    hostname === "bsky.app" ||
    hostname === "staging.bsky.app" ||
    hostname === "asphodel.is" ||
    hostname === "main.asphodel.is" ||
    hostname === "shadowsky.io" ||
    hostname === "main.shadowsky.io"
  ) {
    const pathSegments = path?.split("/").filter(Boolean) || [];

    // Profile URL: /profile/{handle}
    if (pathSegments[0] === "profile" && pathSegments.length === 2) {
      const handle = pathSegments[1];
      return `/(app)/(tabs)/(home)/profile/${handle}`;
    }

    // Post URL: /profile/{handle}/post/{rkey}
    if (
      pathSegments[0] === "profile" &&
      pathSegments[2] === "post" &&
      pathSegments.length === 4
    ) {
      const handle = pathSegments[1];
      const rkey = pathSegments[3];
      return `/(app)/(tabs)/(home)/thread/${rkey}?handle=${handle}`;
    }

    // Search URL: /search?q={query}
    if (
      pathSegments[0] === "search" ||
      (pathSegments.length === 0 && queryParams?.q)
    ) {
      const query = (queryParams?.q as string) || "";
      return `/(app)/(tabs)/(search)?query=${encodeURIComponent(query)}`;
    }

    // Feed URL: /feeds/{feedUri}
    if (pathSegments[0] === "feeds" && pathSegments.length === 2) {
      const feedUri = pathSegments[1];
      const decodedUri = decodeURIComponent(feedUri);
      return `/(app)/feed/${encodeURIComponent(decodedUri)}`;
    }
  }

  // No match — return default home route
  return "/(app)/(tabs)/(home)";
}

/**
 * Convenience: parse a raw URL and resolve its route in one call.
 */
export function resolveDeepLink(url: string): string | null {
  if (!url) return null;
  const parsed = parseURL(url);
  return resolveRoute(parsed);
}
