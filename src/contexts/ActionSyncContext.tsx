/**
 * ActionSyncContext - Tracks sync state for individual post actions
 *
 * Provides per-action sync status (pending, synced, failed) for:
 * - Like/Unlike
 * - Repost/Unrepost
 * - Bookmark
 * - Follow/Unfollow
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { SyncStatus } from "../components/SyncStatusBadge";

export type ActionType = "like" | "repost" | "bookmark" | "follow";

interface ActionState {
  status: SyncStatus;
  timestamp: number;
}

type ActionKey = `${ActionType}:${string}`;

interface ActionSyncContextType {
  getActionStatus: (actionType: ActionType, targetUri: string) => SyncStatus;
  setActionPending: (actionType: ActionType, targetUri: string) => void;
  setActionSynced: (actionType: ActionType, targetUri: string) => void;
  setActionFailed: (
    actionType: ActionType,
    targetUri: string,
    retryFn?: () => void,
  ) => void;
  setActionIdle: (actionType: ActionType, targetUri: string) => void;
  getRetryFn: (
    actionType: ActionType,
    targetUri: string,
  ) => (() => void) | undefined;
}

const ActionSyncContext = createContext<ActionSyncContextType | null>(null);

const ACTION_SYNCED_DURATION = 1500;

export function ActionSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actionStates, setActionStates] = useState<Map<ActionKey, ActionState>>(
    new Map(),
  );
  const retryFunctions = useRef<Map<ActionKey, () => void>>(new Map());
  const timeoutRefs = useRef<Map<ActionKey, NodeJS.Timeout>>(new Map());

  const getActionKey = (actionType: ActionType, targetUri: string): ActionKey =>
    `${actionType}:${targetUri}`;

  const clearTimeout = (key: ActionKey) => {
    const timeout = timeoutRefs.current.get(key);
    if (timeout) {
      globalThis.clearTimeout(timeout);
      timeoutRefs.current.delete(key);
    }
  };

  const getActionStatus = useCallback(
    (actionType: ActionType, targetUri: string): SyncStatus => {
      const key = getActionKey(actionType, targetUri);
      return actionStates.get(key)?.status ?? "idle";
    },
    [actionStates],
  );

  const setActionPending = useCallback(
    (actionType: ActionType, targetUri: string) => {
      const key = getActionKey(actionType, targetUri);
      clearTimeout(key);
      retryFunctions.current.delete(key);

      setActionStates((prev) => {
        const next = new Map(prev);
        next.set(key, { status: "pending", timestamp: Date.now() });
        return next;
      });
    },
    [],
  );

  const setActionSynced = useCallback(
    (actionType: ActionType, targetUri: string) => {
      const key = getActionKey(actionType, targetUri);
      clearTimeout(key);
      retryFunctions.current.delete(key);

      setActionStates((prev) => {
        const next = new Map(prev);
        next.set(key, { status: "synced", timestamp: Date.now() });
        return next;
      });

      const timeout = setTimeout(() => {
        setActionStates((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        timeoutRefs.current.delete(key);
      }, ACTION_SYNCED_DURATION);

      timeoutRefs.current.set(key, timeout);
    },
    [],
  );

  const setActionFailed = useCallback(
    (actionType: ActionType, targetUri: string, retryFn?: () => void) => {
      const key = getActionKey(actionType, targetUri);
      clearTimeout(key);

      if (retryFn) {
        retryFunctions.current.set(key, retryFn);
      }

      setActionStates((prev) => {
        const next = new Map(prev);
        next.set(key, { status: "failed", timestamp: Date.now() });
        return next;
      });
    },
    [],
  );

  const setActionIdle = useCallback(
    (actionType: ActionType, targetUri: string) => {
      const key = getActionKey(actionType, targetUri);
      clearTimeout(key);
      retryFunctions.current.delete(key);

      setActionStates((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    [],
  );

  const getRetryFn = useCallback(
    (actionType: ActionType, targetUri: string): (() => void) | undefined => {
      const key = getActionKey(actionType, targetUri);
      return retryFunctions.current.get(key);
    },
    [],
  );

  return (
    <ActionSyncContext.Provider
      value={{
        getActionStatus,
        setActionPending,
        setActionSynced,
        setActionFailed,
        setActionIdle,
        getRetryFn,
      }}
    >
      {children}
    </ActionSyncContext.Provider>
  );
}

export function useActionSync() {
  const context = useContext(ActionSyncContext);
  if (!context) {
    throw new Error("useActionSync must be used within an ActionSyncProvider");
  }
  return context;
}

export function useActionSyncOptional() {
  return useContext(ActionSyncContext);
}
