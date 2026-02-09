import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { batchedStorage } from "../services/storage/batched-local-storage";

interface ModerationContextType {
  mutedUsers: Set<string>;
  mutedThreads: Set<string>;
  blockedUsers: Set<string>;
  muteUser: (did: string) => void;
  unmuteUser: (did: string) => void;
  muteThread: (uri: string) => void;
  unmuteThread: (uri: string) => void;
  blockUser: (did: string) => void;
  unblockUser: (did: string) => void;
  isUserMuted: (did: string) => boolean;
  isThreadMuted: (uri: string) => boolean;
  isUserBlocked: (did: string) => boolean;
}

const ModerationContext = createContext<ModerationContextType | undefined>(
  undefined,
);

const MUTED_USERS_KEY = "shadowsky_muted_users";
const MUTED_THREADS_KEY = "shadowsky_muted_threads";
const BLOCKED_USERS_KEY = "shadowsky_blocked_users";

export const ModerationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [mutedThreads, setMutedThreads] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedMutedUsers = batchedStorage.getItem(MUTED_USERS_KEY);
      const storedMutedThreads = batchedStorage.getItem(MUTED_THREADS_KEY);
      const storedBlockedUsers = batchedStorage.getItem(BLOCKED_USERS_KEY);

      if (storedMutedUsers) {
        setMutedUsers(new Set(JSON.parse(storedMutedUsers)));
      }
      if (storedMutedThreads) {
        setMutedThreads(new Set(JSON.parse(storedMutedThreads)));
      }
      if (storedBlockedUsers) {
        setBlockedUsers(new Set(JSON.parse(storedBlockedUsers)));
      }
    } catch (error) {
      console.error("Failed to load moderation data:", error);
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      batchedStorage.setItem(
        MUTED_USERS_KEY,
        JSON.stringify(Array.from(mutedUsers)),
      );
    } catch (error) {
      console.error("Failed to save muted users:", error);
    }
  }, [mutedUsers]);

  useEffect(() => {
    try {
      batchedStorage.setItem(
        MUTED_THREADS_KEY,
        JSON.stringify(Array.from(mutedThreads)),
      );
    } catch (error) {
      console.error("Failed to save muted threads:", error);
    }
  }, [mutedThreads]);

  useEffect(() => {
    try {
      batchedStorage.setItem(
        BLOCKED_USERS_KEY,
        JSON.stringify(Array.from(blockedUsers)),
      );
    } catch (error) {
      console.error("Failed to save blocked users:", error);
    }
  }, [blockedUsers]);

  // Expose to window for debugging (DEV only)
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as {
        getModerationData: () => {
          mutedUsers: string[];
          mutedThreads: string[];
          blockedUsers: string[];
        };
        clearModerationData: () => void;
      }).getModerationData = () => ({
        mutedUsers: Array.from(mutedUsers),
        mutedThreads: Array.from(mutedThreads),
        blockedUsers: Array.from(blockedUsers),
      });
      (window as unknown as {
        getModerationData: () => {
          mutedUsers: string[];
          mutedThreads: string[];
          blockedUsers: string[];
        };
        clearModerationData: () => void;
      }).clearModerationData = () => {
        setMutedUsers(new Set());
        setMutedThreads(new Set());
        setBlockedUsers(new Set());
      };
    }
  }, [mutedUsers, mutedThreads, blockedUsers]);

  const muteUser = useCallback((did: string) => {
    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(did);
      return newSet;
    });
  }, []);

  const unmuteUser = useCallback((did: string) => {
    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(did);
      return newSet;
    });
  }, []);

  const muteThread = useCallback((uri: string) => {
    setMutedThreads((prev) => {
      const newSet = new Set(prev);
      newSet.add(uri);
      return newSet;
    });
  }, []);

  const unmuteThread = useCallback((uri: string) => {
    setMutedThreads((prev) => {
      const newSet = new Set(prev);
      newSet.delete(uri);
      return newSet;
    });
  }, []);

  const blockUser = useCallback((did: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(did);
      return newSet;
    });
  }, []);

  const unblockUser = useCallback((did: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(did);
      return newSet;
    });
  }, []);

  const isUserMuted = useCallback(
    (did: string) => mutedUsers.has(did),
    [mutedUsers],
  );
  const isThreadMuted = useCallback(
    (uri: string) => mutedThreads.has(uri),
    [mutedThreads],
  );
  const isUserBlocked = useCallback(
    (did: string) => blockedUsers.has(did),
    [blockedUsers],
  );

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      mutedUsers,
      mutedThreads,
      blockedUsers,
      muteUser,
      unmuteUser,
      muteThread,
      unmuteThread,
      blockUser,
      unblockUser,
      isUserMuted,
      isThreadMuted,
      isUserBlocked,
    }),
    [
      mutedUsers,
      mutedThreads,
      blockedUsers,
      muteUser,
      unmuteUser,
      muteThread,
      unmuteThread,
      blockUser,
      unblockUser,
      isUserMuted,
      isThreadMuted,
      isUserBlocked,
    ],
  );

  return (
    <ModerationContext.Provider value={contextValue}>
      {children}
    </ModerationContext.Provider>
  );
};

export const useModeration = () => {
  const context = useContext(ModerationContext);
  if (!context) {
    throw new Error("useModeration must be used within a ModerationProvider");
  }
  return context;
};
