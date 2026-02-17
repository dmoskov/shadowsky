import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import * as Linking from "expo-linking";

/**
 * +native-intent.tsx handles deep linking URL patterns and maps them to app routes
 * This file is automatically invoked by Expo Router when the app is opened via a deep link
 *
 * Supported URL patterns:
 * - bsky.app/profile/{handle} -> /profile/[handle]
 * - bsky.app/profile/{handle}/post/{rkey} -> /thread/[postId] (construct AT URI)
 * - bsky.app/search?q={query} -> /search?q={query}
 * - bsky.app/feeds/{feedUri} -> /feeds/[uri]
 * - shadowsky://oauth/callback -> OAuth handler
 * - shadowsky://compose?url={url}&text={text} -> Compose screen with shared content
 * - shadowsky://profile/{handle} -> Profile screen (from Spotlight search)
 * - shadowsky://post/{handle}/{rkey} -> Thread screen (from Spotlight search)
 */

export default function NativeIntent() {
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    const handleUrl = async () => {
      const url = await Linking.getInitialURL();
      if (!url) return;

      const parsed = Linking.parse(url);
      const { hostname, path, queryParams } = parsed;

      // Handle OAuth callback (shadowsky:// scheme)
      if (hostname === "oauth" && path === "callback") {
        const params = new URLSearchParams();
        if (queryParams?.code) params.append("code", queryParams.code as string);
        if (queryParams?.state) params.append("state", queryParams.state as string);
        if (queryParams?.error) params.append("error", queryParams.error as string);
        if (queryParams?.iss) params.append("iss", queryParams.iss as string);
        setRedirect(`/(auth)/oauth-callback?${params.toString()}`);
        return;
      }

      // Handle compose deep link from Share Extension (shadowsky://compose)
      if (hostname === "compose") {
        const params = new URLSearchParams();
        if (queryParams?.url) params.append("url", queryParams.url as string);
        if (queryParams?.text) params.append("text", queryParams.text as string);
        if (queryParams?.hasImages) params.append("hasImages", "true");
        setRedirect(`/(app)/compose?${params.toString()}`);
        return;
      }

      // Handle Spotlight deep links (shadowsky://profile/{handle})
      if (hostname === "profile" && path) {
        const handle = path.split("/").filter(Boolean)[0];
        if (handle) {
          setRedirect(`/(app)/(tabs)/(home)/profile/${handle}`);
          return;
        }
      }

      // Handle Spotlight deep links (shadowsky://post/{handle}/{rkey})
      if (hostname === "post" && path) {
        const segments = path.split("/").filter(Boolean);
        if (segments.length >= 2) {
          const handle = segments[0];
          const rkey = segments[1];
          setRedirect(`/(app)/(tabs)/(home)/thread/${rkey}?handle=${handle}`);
          return;
        }
      }

      // Handle bsky.app URLs
      if (hostname === "bsky.app" || hostname === "staging.bsky.app" ||
          hostname === "shadowsky.io" || hostname === "main.shadowsky.io") {

        const pathSegments = path?.split("/").filter(Boolean) || [];

        // Profile URL: /profile/{handle}
        if (pathSegments[0] === "profile" && pathSegments.length === 2) {
          const handle = pathSegments[1];
          setRedirect(`/(app)/(tabs)/(home)/profile/${handle}`);
          return;
        }

        // Post URL: /profile/{handle}/post/{rkey}
        if (pathSegments[0] === "profile" && pathSegments[2] === "post" && pathSegments.length === 4) {
          const handle = pathSegments[1];
          const rkey = pathSegments[3];
          // Pass both handle and rkey - ThreadScreen will resolve the DID and construct the AT URI
          setRedirect(`/(app)/(tabs)/(home)/thread/${rkey}?handle=${handle}`);
          return;
        }

        // Search URL: /search?q={query}
        if (pathSegments[0] === "search" || (pathSegments.length === 0 && queryParams?.q)) {
          const query = queryParams?.q as string || "";
          setRedirect(`/(app)/(tabs)/(search)?query=${encodeURIComponent(query)}`);
          return;
        }

        // Feed URL: /feeds/{feedUri}
        if (pathSegments[0] === "feeds" && pathSegments.length === 2) {
          const feedUri = pathSegments[1];
          // Decode the feed URI if it's URL encoded
          const decodedUri = decodeURIComponent(feedUri);
          setRedirect(`/(app)/feed/${encodeURIComponent(decodedUri)}`);
          return;
        }
      }

      // Default: redirect to home if we couldn't match a pattern
      console.warn("Unhandled deep link URL:", url);
      setRedirect("/(app)/(tabs)/(home)");
    };

    handleUrl();
  }, []);

  if (redirect) {
    return <Redirect href={redirect as any} />;
  }

  // Return null while processing
  return null;
}
