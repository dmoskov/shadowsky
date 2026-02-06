import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { batchedStorage } from "../services/storage/batched-local-storage";

interface HiddenPostsContextType {
  hiddenPosts: Set<string>;
  hidePost: (uri: string) => void;
  unhidePost: (uri: string) => void;
  isPostHidden: (uri: string) => boolean;
  clearHiddenPosts: () => void;
}

const HiddenPostsContext = createContext<HiddenPostsContextType | undefined>(
  undefined,
);

const HIDDEN_POSTS_KEY = "shadowsky_hidden_posts";

export const HiddenPostsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());

  // Expose to window for debugging (DEV only)
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).clearHiddenPosts = () => {
        setHiddenPosts(new Set());
        console.log("All hidden posts have been cleared");
      };
      (window as any).getHiddenPosts = () => {
        return Array.from(hiddenPosts);
      };
    }
  }, [hiddenPosts]);

  // Load hidden posts from localStorage on mount
  useEffect(() => {
    try {
      const stored = batchedStorage.getItem(HIDDEN_POSTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHiddenPosts(new Set(parsed));
      }
    } catch (error) {
      console.error("Failed to load hidden posts:", error);
    }
  }, []);

  // Save to localStorage whenever hiddenPosts changes
  useEffect(() => {
    try {
      batchedStorage.setItem(
        HIDDEN_POSTS_KEY,
        JSON.stringify(Array.from(hiddenPosts)),
      );
    } catch (error) {
      console.error("Failed to save hidden posts:", error);
    }
  }, [hiddenPosts]);

  const hidePost = useCallback((uri: string) => {
    setHiddenPosts((prev) => {
      const newSet = new Set(prev);
      newSet.add(uri);
      return newSet;
    });
  }, []);

  const unhidePost = useCallback((uri: string) => {
    setHiddenPosts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(uri);
      return newSet;
    });
  }, []);

  const isPostHidden = useCallback(
    (uri: string) => {
      return hiddenPosts.has(uri);
    },
    [hiddenPosts],
  );

  const clearHiddenPosts = useCallback(() => {
    setHiddenPosts(new Set());
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      hiddenPosts,
      hidePost,
      unhidePost,
      isPostHidden,
      clearHiddenPosts,
    }),
    [hiddenPosts, hidePost, unhidePost, isPostHidden, clearHiddenPosts],
  );

  return (
    <HiddenPostsContext.Provider value={contextValue}>
      {children}
    </HiddenPostsContext.Provider>
  );
};

export const useHiddenPosts = () => {
  const context = useContext(HiddenPostsContext);
  if (!context) {
    throw new Error("useHiddenPosts must be used within a HiddenPostsProvider");
  }
  return context;
};
