import { useEffect, useRef } from "react";
import { useKeyboardShortcutsContext } from "../../contexts/KeyboardShortcutsContext";
import { useBookmarks } from "../../hooks/useBookmarks";
import { useOptimisticPosts } from "../../hooks/useOptimisticPosts";
import type { Post } from "./types";

interface UseHomeKeyboardOptions {
  posts: any[];
  focusedPostIndex: number;
  setFocusedPostIndex: React.Dispatch<React.SetStateAction<number>>;
  isFocused: boolean;
  columnId?: string;
  handlePostClick: (post: Post) => void;
  handleReply: (post: Post) => void;
  postRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useHomeKeyboard({
  posts,
  focusedPostIndex,
  setFocusedPostIndex,
  isFocused,
  columnId,
  handlePostClick,
  handleReply,
  postRefs,
  containerRef,
}: UseHomeKeyboardOptions) {
  const { setFocusedPost, registerPostActions, unregisterPostActions } =
    useKeyboardShortcutsContext();
  const { likeMutation, repostMutation, undoableUnlike, undoableUnrepost } =
    useOptimisticPosts();
  const { toggleBookmark } = useBookmarks();
  const isKeyboardNavigationRef = useRef(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isFocused) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        document.body.classList.contains("thread-modal-open") ||
        document.body.classList.contains("conversation-modal-open")
      ) {
        return;
      }

      let handled = false;
      const currentIndex = focusedPostIndex;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          handled = true;
          isKeyboardNavigationRef.current = true;
          if (currentIndex < posts.length - 1) {
            setFocusedPostIndex(currentIndex + 1);
          } else if (currentIndex === -1 && posts.length > 0) {
            setFocusedPostIndex(0);
          }
          break;

        case "ArrowUp":
        case "k":
          e.preventDefault();
          handled = true;
          isKeyboardNavigationRef.current = true;
          if (currentIndex > 0) {
            setFocusedPostIndex(currentIndex - 1);
          } else if (currentIndex === -1 && posts.length > 0) {
            setFocusedPostIndex(posts.length - 1);
          }
          break;

        case "Enter":
          e.preventDefault();
          handled = true;
          if (currentIndex >= 0 && currentIndex < posts.length) {
            const feedItem = posts[currentIndex];
            if (
              feedItem?.post &&
              "author" in feedItem.post &&
              "record" in feedItem.post
            ) {
              handlePostClick(feedItem.post as unknown as Post);
            }
          }
          break;

        case "Home":
          e.preventDefault();
          handled = true;
          isKeyboardNavigationRef.current = true;
          if (posts.length > 0) {
            setFocusedPostIndex(0);
          }
          break;

        case "End":
          e.preventDefault();
          handled = true;
          isKeyboardNavigationRef.current = true;
          if (posts.length > 0) {
            setFocusedPostIndex(posts.length - 1);
          }
          break;

        case "PageUp":
          e.preventDefault();
          handled = true;
          isKeyboardNavigationRef.current = true;
          setFocusedPostIndex(Math.max(0, currentIndex - 5));
          break;

        case "PageDown":
          e.preventDefault();
          handled = true;
          isKeyboardNavigationRef.current = true;
          setFocusedPostIndex(Math.min(posts.length - 1, currentIndex + 5));
          break;

        case "Escape":
          setFocusedPostIndex(-1);
          handled = true;
          break;

        case " ":
          if (!e.shiftKey) {
            e.preventDefault();
            window.scrollBy({
              top: window.innerHeight * 0.8,
              behavior: "smooth",
            });
            handled = true;
          }
          break;
      }

      if (handled) {
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [posts, focusedPostIndex, isFocused, handlePostClick, setFocusedPostIndex]);

  useEffect(() => {
    if (
      focusedPostIndex >= 0 &&
      focusedPostIndex < posts.length &&
      isKeyboardNavigationRef.current
    ) {
      const post = posts[focusedPostIndex]?.post;
      if (post) {
        const postKey = `${post.uri}-${focusedPostIndex}`;
        const postEl = postRefs.current[postKey];
        if (postEl) {
          postEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          postEl.focus();
        }
      }
      isKeyboardNavigationRef.current = false;
    }
  }, [focusedPostIndex, posts, postRefs]);

  useEffect(() => {
    if (containerRef.current && isFocused) {
      containerRef.current.focus();
    }
  }, [isFocused, containerRef]);

  useEffect(() => {
    if (!isFocused) {
      setFocusedPostIndex(-1);
    }
  }, [isFocused, setFocusedPostIndex]);

  useEffect(() => {
    if (focusedPostIndex >= 0 && focusedPostIndex < posts.length) {
      const feedItem = posts[focusedPostIndex];
      if (feedItem?.post) {
        setFocusedPost({
          post: feedItem.post,
          index: focusedPostIndex,
          columnId: columnId || "home",
        });
      }
    } else {
      setFocusedPost(null);
    }
  }, [focusedPostIndex, posts, columnId, setFocusedPost]);

  useEffect(() => {
    const effectiveColumnId = columnId || "home";
    registerPostActions(effectiveColumnId, {
      onLike: (post) => {
        if (post.viewer?.like) {
          undoableUnlike(post.uri, post.viewer.like);
        } else {
          likeMutation.mutate({ uri: post.uri, cid: post.cid });
        }
      },
      onRepost: (post) => {
        if (post.viewer?.repost) {
          undoableUnrepost(post.uri, post.viewer.repost);
        } else {
          repostMutation.mutate({ uri: post.uri, cid: post.cid });
        }
      },
      onReply: (post) => {
        handleReply(post as unknown as Post);
      },
      onBookmark: (post) => {
        toggleBookmark(post);
      },
      onShare: async (post) => {
        const shareUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`;
        if (navigator.share) {
          try {
            await navigator.share({
              title: "Share post",
              url: shareUrl,
            });
          } catch {
            await navigator.clipboard.writeText(shareUrl);
          }
        } else {
          await navigator.clipboard.writeText(shareUrl);
        }
      },
      onOpen: (post) => {
        handlePostClick(post as unknown as Post);
      },
      onMoreMenu: (post) => {
        const postEl = document.querySelector(
          `[data-post-uri="${post.uri}"][aria-selected="true"]`,
        );
        if (postEl) {
          const moreBtn = postEl.querySelector(
            '[aria-label="More options"]',
          ) as HTMLButtonElement | null;
          moreBtn?.click();
        }
      },
      onNavigateNext: () => {
        if (focusedPostIndex < posts.length - 1) {
          isKeyboardNavigationRef.current = true;
          setFocusedPostIndex((prev) => prev + 1);
        } else if (focusedPostIndex === -1 && posts.length > 0) {
          isKeyboardNavigationRef.current = true;
          setFocusedPostIndex(0);
        }
      },
      onNavigatePrev: () => {
        if (focusedPostIndex > 0) {
          isKeyboardNavigationRef.current = true;
          setFocusedPostIndex((prev) => prev - 1);
        } else if (focusedPostIndex === -1 && posts.length > 0) {
          isKeyboardNavigationRef.current = true;
          setFocusedPostIndex(posts.length - 1);
        }
      },
    });

    return () => unregisterPostActions(effectiveColumnId);
  }, [
    columnId,
    registerPostActions,
    unregisterPostActions,
    likeMutation,
    undoableUnlike,
    repostMutation,
    undoableUnrepost,
    toggleBookmark,
    focusedPostIndex,
    posts,
    handlePostClick,
    handleReply,
    setFocusedPostIndex,
  ]);

  return { isKeyboardNavigationRef };
}
