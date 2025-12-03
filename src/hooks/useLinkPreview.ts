import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLinkMetadata, LinkMetadata } from "../services/anthropic";
import { createLogger } from "../utils/logger";

const logger = createLogger("useLinkPreview");

// URL regex that matches most common URL patterns
const URL_REGEX =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

// Bluesky URL patterns to exclude (these become quote posts, not link previews)
const BSKY_URL_PATTERNS = [
  /https?:\/\/(?:www\.)?bsky\.app\/profile\/[^/]+\/post\/[a-zA-Z0-9]+/i,
  /https?:\/\/(?:www\.)?staging\.bsky\.app\/profile\/[^/]+\/post\/[a-zA-Z0-9]+/i,
];

export interface LinkPreviewState {
  isLoading: boolean;
  metadata: LinkMetadata | null;
  error: string | null;
  detectedUrl: string | null;
}

export function useLinkPreview(text: string) {
  const [state, setState] = useState<LinkPreviewState>({
    isLoading: false,
    metadata: null,
    error: null,
    detectedUrl: null,
  });

  // Track the last fetched URL to avoid duplicate fetches
  const lastFetchedUrl = useRef<string | null>(null);
  // Track if component is mounted
  const isMounted = useRef(true);

  const extractFirstUrl = useCallback((text: string): string | null => {
    const matches = text.match(URL_REGEX);
    if (!matches || matches.length === 0) return null;

    // Find the first URL that's not a Bluesky post URL
    for (const url of matches) {
      const isBskyUrl = BSKY_URL_PATTERNS.some((pattern) => pattern.test(url));
      if (!isBskyUrl) {
        return url;
      }
    }

    return null;
  }, []);

  const clearPreview = useCallback(() => {
    setState({
      isLoading: false,
      metadata: null,
      error: null,
      detectedUrl: null,
    });
    lastFetchedUrl.current = null;
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const url = extractFirstUrl(text);

    // If no URL found, clear state
    if (!url) {
      if (state.detectedUrl) {
        clearPreview();
      }
      return;
    }

    // If same URL as last fetch, don't refetch
    if (url === lastFetchedUrl.current) {
      return;
    }

    // Debounce the fetch
    const timer = setTimeout(async () => {
      if (!isMounted.current) return;

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        detectedUrl: url,
      }));

      try {
        lastFetchedUrl.current = url;
        const metadata = await fetchLinkMetadata(url);

        if (!isMounted.current) return;

        setState({
          isLoading: false,
          metadata,
          error: null,
          detectedUrl: url,
        });
      } catch (error) {
        if (!isMounted.current) return;

        logger.error("Failed to fetch link metadata:", error);
        setState({
          isLoading: false,
          metadata: null,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch link preview",
          detectedUrl: url,
        });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [text, extractFirstUrl, clearPreview, state.detectedUrl]);

  return {
    ...state,
    clearPreview,
  };
}
