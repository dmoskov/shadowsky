import React, { useEffect, useState } from "react";
import { OPEN_THREAD_KEY, type Post } from "./Home.types";

function readStoredThreadPost(): Post | null {
  try {
    const stored = sessionStorage.getItem(OPEN_THREAD_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only restore if it was stored recently (within 30 seconds)
      // This prevents restoring stale thread state on page refresh
      if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
        return parsed.post;
      }
      // Clean up stale data
      sessionStorage.removeItem(OPEN_THREAD_KEY);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Thread modal state for the home feed: which post's thread is open, whether
 * it opened in reply/quote mode, and sessionStorage persistence so the open
 * thread survives view mode changes. Extracted from Home.tsx.
 */
export function useThreadModalState() {
  // Restore open thread state from sessionStorage (persists across view mode changes)
  const [selectedPost, setSelectedPost] = useState<Post | null>(() =>
    readStoredThreadPost(),
  );
  const [showThread, setShowThread] = useState(
    () => readStoredThreadPost() !== null,
  );
  const [openThreadToReply, setOpenThreadToReply] = useState(false);
  const [openThreadToQuote, setOpenThreadToQuote] = useState(false);

  // Persist open thread state to sessionStorage for view mode transitions
  useEffect(() => {
    if (showThread && selectedPost) {
      sessionStorage.setItem(
        OPEN_THREAD_KEY,
        JSON.stringify({
          post: selectedPost,
          timestamp: Date.now(),
        }),
      );
    } else {
      sessionStorage.removeItem(OPEN_THREAD_KEY);
    }
  }, [showThread, selectedPost]);

  /** Open a post's thread normally (no reply/quote focus). */
  const openThread = React.useCallback((post: Post) => {
    setSelectedPost(post);
    setOpenThreadToReply(false); // Reset when clicking on post normally
    setShowThread(true);
  }, []);

  /** Open a post's thread with the reply composer focused. */
  const openThreadToReplyTo = React.useCallback((post: Post) => {
    setSelectedPost(post);
    setOpenThreadToReply(true);
    setOpenThreadToQuote(false);
    setShowThread(true);
  }, []);

  /** Open a post's thread with the quote composer focused. */
  const openThreadToQuotePost = React.useCallback((post: Post) => {
    setSelectedPost(post);
    setOpenThreadToReply(false);
    setOpenThreadToQuote(true);
    setShowThread(true);
  }, []);

  /** Open a quoted post's thread given only its URI. */
  const openThreadByUri = React.useCallback((uri: string) => {
    setSelectedPost({ uri } as Post);
    setOpenThreadToReply(false);
    setShowThread(true);
  }, []);

  const closeThread = React.useCallback(() => {
    setShowThread(false);
    setSelectedPost(null);
    setOpenThreadToReply(false);
    setOpenThreadToQuote(false);
  }, []);

  return {
    selectedPost,
    showThread,
    openThreadToReply,
    openThreadToQuote,
    openThread,
    openThreadToReplyTo,
    openThreadToQuotePost,
    openThreadByUri,
    closeThread,
  };
}
