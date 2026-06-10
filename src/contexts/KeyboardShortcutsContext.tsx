import type { AppBskyFeedDefs } from "@atproto/api";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface FocusedPostInfo {
  post: AppBskyFeedDefs.PostView;
  index: number;
  columnId?: string;
}

export interface KeyboardShortcutsContextType {
  // Current focused post across all columns
  focusedPost: FocusedPostInfo | null;
  setFocusedPost: (info: FocusedPostInfo | null) => void;

  // Register post action callbacks from components
  registerPostActions: (columnId: string, actions: PostActionCallbacks) => void;
  unregisterPostActions: (columnId: string) => void;

  // Trigger actions on focused post
  likePost: () => void;
  repostPost: () => void;
  replyToPost: () => void;
  bookmarkPost: () => void;
  sharePost: () => void;
  openPost: () => void;
  moreMenuPost: () => void;

  // Navigation
  navigateNext: () => void;
  navigatePrev: () => void;

  // Shortcuts help modal
  isShortcutsHelpOpen: boolean;
  setIsShortcutsHelpOpen: (open: boolean) => void;

  // Check if shortcuts are enabled (not in input/modal)
  areShortcutsEnabled: () => boolean;
}

export interface PostActionCallbacks {
  onLike?: (post: AppBskyFeedDefs.PostView) => void;
  onRepost?: (post: AppBskyFeedDefs.PostView) => void;
  onReply?: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark?: (post: AppBskyFeedDefs.PostView) => void;
  onShare?: (post: AppBskyFeedDefs.PostView) => void;
  onOpen?: (post: AppBskyFeedDefs.PostView) => void;
  onMoreMenu?: (post: AppBskyFeedDefs.PostView) => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
}

const KeyboardShortcutsContext = createContext<
  KeyboardShortcutsContextType | undefined
>(undefined);

/**
 * Stable subset of the keyboard shortcuts API. This context value never
 * changes identity, so components that only need to *report* focus or
 * register actions (e.g. feed columns) don't re-render every time the
 * focused post changes — possibly in a different column entirely.
 */
export interface KeyboardShortcutsActionsType {
  setFocusedPost: (info: FocusedPostInfo | null) => void;
  registerPostActions: (columnId: string, actions: PostActionCallbacks) => void;
  unregisterPostActions: (columnId: string) => void;
  setIsShortcutsHelpOpen: (open: boolean) => void;
}

const KeyboardShortcutsActionsContext = createContext<
  KeyboardShortcutsActionsType | undefined
>(undefined);

// G-key sequence timeout in milliseconds
const G_KEY_TIMEOUT = 1000;

export function KeyboardShortcutsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [focusedPost, setFocusedPost] = useState<FocusedPostInfo | null>(null);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Track g-key prefix for vim-style navigation sequences (g+h, g+n, etc.)
  const gKeyPendingRef = useRef(false);
  const gKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store registered action callbacks by column ID
  const actionCallbacksRef = useRef<Map<string, PostActionCallbacks>>(
    new Map(),
  );

  const registerPostActions = useCallback(
    (columnId: string, actions: PostActionCallbacks) => {
      actionCallbacksRef.current.set(columnId, actions);
    },
    [],
  );

  const unregisterPostActions = useCallback((columnId: string) => {
    actionCallbacksRef.current.delete(columnId);
  }, []);

  // Check if we're in an editable context or modal is open
  const areShortcutsEnabled = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const isEditable =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.isContentEditable;

    const hasModalOpen =
      document.body.classList.contains("thread-modal-open") ||
      document.body.classList.contains("conversation-modal-open") ||
      document.body.classList.contains("command-palette-open") ||
      isShortcutsHelpOpen;

    return !isEditable && !hasModalOpen;
  }, [isShortcutsHelpOpen]);

  // Get the current column's action callbacks
  const getCurrentCallbacks = useCallback(() => {
    if (!focusedPost?.columnId) {
      // Return the first registered callbacks if no column is focused
      const entries = Array.from(actionCallbacksRef.current.entries());
      return entries.length > 0 ? entries[0][1] : null;
    }
    return actionCallbacksRef.current.get(focusedPost.columnId) || null;
  }, [focusedPost?.columnId]);

  // Action handlers
  const likePost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onLike?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const repostPost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onRepost?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const replyToPost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onReply?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const bookmarkPost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onBookmark?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const sharePost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onShare?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const openPost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onOpen?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const moreMenuPost = useCallback(() => {
    if (!focusedPost) return;
    const callbacks = getCurrentCallbacks();
    callbacks?.onMoreMenu?.(focusedPost.post);
  }, [focusedPost, getCurrentCallbacks]);

  const navigateNext = useCallback(() => {
    const callbacks = getCurrentCallbacks();
    callbacks?.onNavigateNext?.();
  }, [getCurrentCallbacks]);

  const navigatePrev = useCallback(() => {
    const callbacks = getCurrentCallbacks();
    callbacks?.onNavigatePrev?.();
  }, [getCurrentCallbacks]);

  // Clear g-key pending state
  const clearGKeyPending = useCallback(() => {
    gKeyPendingRef.current = false;
    if (gKeyTimeoutRef.current) {
      clearTimeout(gKeyTimeoutRef.current);
      gKeyTimeoutRef.current = null;
    }
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if shortcuts are disabled
      if (!areShortcutsEnabled()) return;

      // Skip if modifier keys are pressed (except Shift for ?)
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      let handled = false;
      const key = event.key.toLowerCase();

      // Handle g-key sequences (vim-style navigation)
      if (gKeyPendingRef.current) {
        clearGKeyPending();

        // Navigate based on the second key in the sequence
        switch (key) {
          case "h":
            // g+h: Go to home
            window.dispatchEvent(
              new CustomEvent("keyboard-navigate", { detail: { to: "/home" } }),
            );
            handled = true;
            break;

          case "n":
            // g+n: Go to notifications
            window.dispatchEvent(
              new CustomEvent("keyboard-navigate", {
                detail: { to: "/notifications" },
              }),
            );
            handled = true;
            break;

          case "m":
            // g+m: Go to messages
            window.dispatchEvent(
              new CustomEvent("keyboard-navigate", {
                detail: { to: "/messages" },
              }),
            );
            handled = true;
            break;

          case "b":
            // g+b: Go to bookmarks
            window.dispatchEvent(
              new CustomEvent("keyboard-navigate", {
                detail: { to: "/bookmarks" },
              }),
            );
            handled = true;
            break;

          case "p":
            // g+p: Go to profile
            window.dispatchEvent(
              new CustomEvent("keyboard-navigate", {
                detail: { to: "/profile" },
              }),
            );
            handled = true;
            break;

          case "s":
            // g+s: Go to search
            window.dispatchEvent(
              new CustomEvent("keyboard-navigate", {
                detail: { to: "/search" },
              }),
            );
            handled = true;
            break;
        }

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      switch (key) {
        case "g":
          // Start g-key sequence
          gKeyPendingRef.current = true;
          // Clear after timeout if no second key pressed
          gKeyTimeoutRef.current = setTimeout(() => {
            gKeyPendingRef.current = false;
          }, G_KEY_TIMEOUT);
          handled = true;
          break;

        case "j":
          // Navigate to next post (vim-style)
          navigateNext();
          handled = true;
          break;

        case "k":
          // Navigate to previous post (vim-style)
          navigatePrev();
          handled = true;
          break;

        case "l":
          // Like focused post
          if (focusedPost) {
            likePost();
            handled = true;
          }
          break;

        case "r":
          // Reply to focused post (C is used in vim-style for compose)
          if (focusedPost) {
            replyToPost();
            handled = true;
          }
          break;

        case "t":
          // Repost focused post (T for "retweet" pattern)
          if (focusedPost) {
            repostPost();
            handled = true;
          }
          break;

        case "b":
          // Bookmark focused post
          if (focusedPost) {
            bookmarkPost();
            handled = true;
          }
          break;

        case "s":
          // Share focused post
          if (focusedPost) {
            sharePost();
            handled = true;
          }
          break;

        case "m":
          // Open more menu on focused post
          if (focusedPost) {
            moreMenuPost();
            handled = true;
          }
          break;

        case "o":
        case "enter":
          // Open focused post details
          if (focusedPost) {
            openPost();
            handled = true;
          }
          break;

        case "/":
          // Focus search - don't handle if Shift is pressed (that's for ?)
          if (!event.shiftKey) {
            const searchInput = document.querySelector(
              'input[placeholder*="Search"], input[type="search"], [data-search-input]',
            ) as HTMLInputElement | null;
            if (searchInput) {
              event.preventDefault();
              searchInput.focus();
              handled = true;
            }
          }
          break;

        case "?":
          // Open shortcuts help (Shift+/)
          setIsShortcutsHelpOpen(true);
          handled = true;
          break;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearGKeyPending();
    };
  }, [
    areShortcutsEnabled,
    focusedPost,
    likePost,
    replyToPost,
    repostPost,
    bookmarkPost,
    sharePost,
    openPost,
    moreMenuPost,
    navigateNext,
    navigatePrev,
    clearGKeyPending,
  ]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      focusedPost,
      setFocusedPost,
      registerPostActions,
      unregisterPostActions,
      likePost,
      repostPost,
      replyToPost,
      bookmarkPost,
      sharePost,
      openPost,
      moreMenuPost,
      navigateNext,
      navigatePrev,
      isShortcutsHelpOpen,
      setIsShortcutsHelpOpen,
      areShortcutsEnabled,
    }),
    [
      focusedPost,
      registerPostActions,
      unregisterPostActions,
      likePost,
      repostPost,
      replyToPost,
      bookmarkPost,
      sharePost,
      openPost,
      moreMenuPost,
      navigateNext,
      navigatePrev,
      isShortcutsHelpOpen,
      areShortcutsEnabled,
    ],
  );

  // All members are stable (useState setters / empty-dep useCallbacks), so
  // this value is created once and consumers of the actions context never
  // re-render due to focus changes.
  const actionsValue = useMemo(
    () => ({
      setFocusedPost,
      registerPostActions,
      unregisterPostActions,
      setIsShortcutsHelpOpen,
    }),
    [registerPostActions, unregisterPostActions],
  );

  return (
    <KeyboardShortcutsActionsContext.Provider value={actionsValue}>
      <KeyboardShortcutsContext.Provider value={contextValue}>
        {children}
      </KeyboardShortcutsContext.Provider>
    </KeyboardShortcutsActionsContext.Provider>
  );
}

export function useKeyboardShortcutsActions() {
  const context = useContext(KeyboardShortcutsActionsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcutsActions must be used within a KeyboardShortcutsProvider",
    );
  }
  return context;
}

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider",
    );
  }
  return context;
}

/**
 * Hook to register post actions for a column/component.
 * Automatically unregisters when the component unmounts.
 */
export function useRegisterPostActions(
  columnId: string,
  actions: PostActionCallbacks,
) {
  const { registerPostActions, unregisterPostActions } =
    useKeyboardShortcutsActions();

  useEffect(() => {
    registerPostActions(columnId, actions);
    return () => unregisterPostActions(columnId);
  }, [columnId, actions, registerPostActions, unregisterPostActions]);
}
