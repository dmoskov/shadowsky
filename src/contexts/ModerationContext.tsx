import React, { createContext, useContext, useEffect, useState } from "react";

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
      const storedMutedUsers = localStorage.getItem(MUTED_USERS_KEY);
      const storedMutedThreads = localStorage.getItem(MUTED_THREADS_KEY);
      const storedBlockedUsers = localStorage.getItem(BLOCKED_USERS_KEY);

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
      localStorage.setItem(
        MUTED_USERS_KEY,
        JSON.stringify(Array.from(mutedUsers)),
      );
    } catch (error) {
      console.error("Failed to save muted users:", error);
    }
  }, [mutedUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(
        MUTED_THREADS_KEY,
        JSON.stringify(Array.from(mutedThreads)),
      );
    } catch (error) {
      console.error("Failed to save muted threads:", error);
    }
  }, [mutedThreads]);

  useEffect(() => {
    try {
      localStorage.setItem(
        BLOCKED_USERS_KEY,
        JSON.stringify(Array.from(blockedUsers)),
      );
    } catch (error) {
      console.error("Failed to save blocked users:", error);
    }
  }, [blockedUsers]);

  // Expose to window for debugging
  React.useEffect(() => {
    (window as any).getModerationData = () => ({
      mutedUsers: Array.from(mutedUsers),
      mutedThreads: Array.from(mutedThreads),
      blockedUsers: Array.from(blockedUsers),
    });
    (window as any).clearModerationData = () => {
      setMutedUsers(new Set());
      setMutedThreads(new Set());
      setBlockedUsers(new Set());
      console.log("All moderation data has been cleared");
    };
  }, [mutedUsers, mutedThreads, blockedUsers]);

  const muteUser = (did: string) => {
    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(did);
      return newSet;
    });
  };

  const unmuteUser = (did: string) => {
    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(did);
      return newSet;
    });
  };

  const muteThread = (uri: string) => {
    setMutedThreads((prev) => {
      const newSet = new Set(prev);
      newSet.add(uri);
      return newSet;
    });
  };

  const unmuteThread = (uri: string) => {
    setMutedThreads((prev) => {
      const newSet = new Set(prev);
      newSet.delete(uri);
      return newSet;
    });
  };

  const blockUser = (did: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(did);
      return newSet;
    });
  };

  const unblockUser = (did: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(did);
      return newSet;
    });
  };

  const isUserMuted = (did: string) => mutedUsers.has(did);
  const isThreadMuted = (uri: string) => mutedThreads.has(uri);
  const isUserBlocked = (did: string) => blockedUsers.has(did);

  return (
    <ModerationContext.Provider
      value={{
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
      }}
    >
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
