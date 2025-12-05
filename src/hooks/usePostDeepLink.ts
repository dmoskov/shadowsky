import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Extract post ID from various post URI formats
 * - at://did:plc:xxx/app.bsky.feed.post/rkey -> rkey
 * - Full AT URI -> last segment (rkey)
 */
export function extractPostId(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

/**
 * Generate a deep link fragment for a post
 * @param postUri - The AT URI of the post
 * @returns The fragment string (e.g., "post-abc123")
 */
export function generatePostFragment(postUri: string): string {
  const postId = extractPostId(postUri);
  return `post-${postId}`;
}

/**
 * Parse a URL hash fragment to extract post ID
 * @param hash - The URL hash (e.g., "#post-abc123")
 * @returns The post ID or null if not a valid post fragment
 */
export function parsePostFragment(hash: string): string | null {
  if (!hash) return null;

  // Remove leading # if present
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;

  // Check for post fragment format
  if (fragment.startsWith("post-")) {
    return fragment.slice(5); // Remove "post-" prefix
  }

  return null;
}

interface UsePostDeepLinkOptions {
  /** Whether the hook should be active */
  enabled?: boolean;
  /** Callback when a post is found and should be scrolled to */
  onPostFound?: (postId: string, element: HTMLElement) => void;
  /** Selector for the scrollable container */
  containerSelector?: string;
}

interface UsePostDeepLinkReturn {
  /** The currently targeted post ID from the URL fragment */
  targetPostId: string | null;
  /** Set the URL fragment to target a specific post */
  setTargetPost: (postUri: string | null) => void;
  /** Clear the current target post from the URL */
  clearTargetPost: () => void;
  /** Scroll to a post by its URI */
  scrollToPost: (postUri: string) => boolean;
  /** Check if a post is currently targeted */
  isTargeted: (postUri: string) => boolean;
  /** Whether the initial scroll has been performed */
  hasScrolledToInitialTarget: boolean;
}

/**
 * Hook for managing URL fragment deep linking to specific posts
 *
 * This hook:
 * 1. Parses URL fragments like #post-abc123 to identify targeted posts
 * 2. Scrolls to targeted posts when they become available in the DOM
 * 3. Updates the URL fragment when a post is programmatically targeted
 * 4. Handles browser back/forward navigation for fragment changes
 *
 * @example
 * ```tsx
 * const { targetPostId, setTargetPost, isTargeted } = usePostDeepLink();
 *
 * // In your post rendering:
 * <div
 *   id={`post-${postId}`}
 *   data-post-id={postId}
 *   className={isTargeted(post.uri) ? "highlighted" : ""}
 * >
 *   ...
 * </div>
 *
 * // To link to a specific post:
 * <button onClick={() => setTargetPost(post.uri)}>
 *   Copy link
 * </button>
 * ```
 */
export function usePostDeepLink(
  options: UsePostDeepLinkOptions = {},
): UsePostDeepLinkReturn {
  const { enabled = true, onPostFound, containerSelector } = options;

  const location = useLocation();
  const navigate = useNavigate();

  const [targetPostId, setTargetPostId] = useState<string | null>(() => {
    if (!enabled) return null;
    return parsePostFragment(window.location.hash);
  });

  const [hasScrolledToInitialTarget, setHasScrolledToInitialTarget] =
    useState(false);
  const scrollAttemptRef = useRef(0);
  const maxScrollAttempts = 20; // Max attempts to find element
  const scrollAttemptDelayMs = 100; // Delay between attempts

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track active timers for cleanup
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, []);

  // Parse hash from current location
  useEffect(() => {
    if (!enabled) return;

    const postId = parsePostFragment(location.hash);
    setTargetPostId(postId);

    // Reset scroll state when target changes
    if (postId !== targetPostId) {
      setHasScrolledToInitialTarget(false);
      scrollAttemptRef.current = 0;
    }
  }, [location.hash, enabled, targetPostId]);

  // Handle browser history changes (back/forward)
  useEffect(() => {
    if (!enabled) return;

    const handleHashChange = () => {
      const postId = parsePostFragment(window.location.hash);
      setTargetPostId(postId);
      setHasScrolledToInitialTarget(false);
      scrollAttemptRef.current = 0;
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [enabled]);

  // Attempt to scroll to the target post
  useEffect(() => {
    if (!enabled || !targetPostId || hasScrolledToInitialTarget) return;

    const attemptScroll = () => {
      // Check if still mounted
      if (!isMountedRef.current) return false;

      // Try to find the post element by ID or data attribute
      const element =
        document.getElementById(`post-${targetPostId}`) ||
        document.querySelector(`[data-post-id="${targetPostId}"]`);

      if (element instanceof HTMLElement) {
        // Scroll element into view
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Add highlight effect
        element.classList.add("deep-link-highlight");

        // Clear any existing highlight timeout before setting a new one
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            element.classList.remove("deep-link-highlight");
          }
          highlightTimeoutRef.current = null;
        }, 2000);

        // Notify callback
        onPostFound?.(targetPostId, element);

        if (isMountedRef.current) {
          setHasScrolledToInitialTarget(true);
        }
        return true;
      }

      return false;
    };

    // Try immediately
    if (attemptScroll()) return;

    // Clear any existing interval before setting a new one
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    // Retry with increasing delays for dynamically loaded content
    scrollIntervalRef.current = setInterval(() => {
      // Check if still mounted
      if (!isMountedRef.current) {
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
        }
        return;
      }

      scrollAttemptRef.current++;

      if (attemptScroll() || scrollAttemptRef.current >= maxScrollAttempts) {
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
        }

        if (
          scrollAttemptRef.current >= maxScrollAttempts &&
          isMountedRef.current
        ) {
          // Element not found after max attempts
          setHasScrolledToInitialTarget(true);
        }
      }
    }, scrollAttemptDelayMs);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [
    enabled,
    targetPostId,
    hasScrolledToInitialTarget,
    onPostFound,
    containerSelector,
  ]);

  // Set the target post (updates URL fragment)
  const setTargetPost = useCallback(
    (postUri: string | null) => {
      if (!enabled) return;

      if (postUri) {
        const fragment = generatePostFragment(postUri);
        const newUrl = `${location.pathname}${location.search}#${fragment}`;
        navigate(newUrl, { replace: true });
      } else {
        // Remove the fragment
        navigate(`${location.pathname}${location.search}`, { replace: true });
      }
    },
    [enabled, location.pathname, location.search, navigate],
  );

  // Clear the target post from the URL
  const clearTargetPost = useCallback(() => {
    if (!enabled) return;

    // Remove the fragment without navigation
    const newUrl = `${location.pathname}${location.search}`;
    window.history.replaceState(null, "", newUrl);
    setTargetPostId(null);
  }, [enabled, location.pathname, location.search]);

  // Scroll to a post by URI
  const scrollToPost = useCallback(
    (postUri: string): boolean => {
      if (!enabled || !isMountedRef.current) return false;

      const postId = extractPostId(postUri);
      const element =
        document.getElementById(`post-${postId}`) ||
        document.querySelector(`[data-post-id="${postId}"]`);

      if (element instanceof HTMLElement) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Update URL fragment
        setTargetPost(postUri);

        // Add highlight effect
        element.classList.add("deep-link-highlight");

        // Clear any existing highlight timeout before setting a new one
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            element.classList.remove("deep-link-highlight");
          }
          highlightTimeoutRef.current = null;
        }, 2000);

        return true;
      }

      return false;
    },
    [enabled, setTargetPost],
  );

  // Check if a post is currently targeted
  const isTargeted = useCallback(
    (postUri: string): boolean => {
      if (!targetPostId) return false;
      const postId = extractPostId(postUri);
      return postId === targetPostId;
    },
    [targetPostId],
  );

  return {
    targetPostId,
    setTargetPost,
    clearTargetPost,
    scrollToPost,
    isTargeted,
    hasScrolledToInitialTarget,
  };
}

/**
 * Generate a shareable URL with a post fragment
 * @param baseUrl - The base URL (e.g., current page URL)
 * @param postUri - The AT URI of the post to link to
 * @returns The full URL with fragment (e.g., "https://example.com/home#post-abc123")
 */
export function generateShareablePostUrl(
  baseUrl: string,
  postUri: string,
): string {
  const fragment = generatePostFragment(postUri);
  const url = new URL(baseUrl);
  url.hash = fragment;
  return url.toString();
}
