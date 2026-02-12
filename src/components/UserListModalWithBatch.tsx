/**
 * UserListModalWithBatch Component
 *
 * Enhanced version of UserListModal that supports batch operations.
 * Wraps the user list with BatchSelectionProvider and adds batch UI controls.
 */

import type { AppBskyActorDefs } from "@atproto/api";
import { CheckSquare, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import {
  BatchSelectionProvider,
  profileToSelectableUser,
  useBatchSelection,
  type BatchActionType,
} from "../contexts/BatchSelectionContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useInfiniteScroll } from "../hooks/useRAFScroll";
import {
  executeBatchOperation,
  executeUndoBatchOperation,
} from "../services/batch-operation-executor";
import {
  blueskyListService,
  type BlueskyList,
} from "../services/bluesky-list-service";
import {
  BatchActionsToolbar,
  BatchConfirmationDialog,
  BatchProgressIndicator,
  UserSelectableRow,
} from "./batch";

interface UserListModalWithBatchProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actor: string;
  type: "followers" | "following";
}

/**
 * List selection dialog for add_to_list action
 */
interface ListSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (list: BlueskyList) => void;
  lists: BlueskyList[];
  loading: boolean;
}

const ListSelectionDialog: React.FC<ListSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  lists,
  loading,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop z-[70]" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-container modal-auto-height modal-sm border bg-white dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select a list"
      >
        <div className="border-b px-4 py-3 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select a List
          </h3>
        </div>
        <div className="asph-scrollbar max-h-64 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : lists.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-400">
              No lists found. Create a list first.
            </p>
          ) : (
            lists.map((list) => (
              <button
                key={list.uri}
                onClick={() => onSelect(list)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="h-8 w-8 rounded bg-gradient-to-br from-blue-400 to-blue-600" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {list.name}
                  </div>
                  {list.description && (
                    <div className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                      {list.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-4 py-3 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Inner component that uses batch selection context
 */
const UserListModalInner: React.FC<UserListModalWithBatchProps> = ({
  isOpen,
  onClose,
  title,
  actor,
  type,
}) => {
  const { agent, session } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppBskyActorDefs.ProfileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Batch operation state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<BatchActionType | null>(
    null,
  );
  const [isUndoing, setIsUndoing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  // List selection
  const [showListDialog, setShowListDialog] = useState(false);
  const [lists, setLists] = useState<BlueskyList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedList, setSelectedList] = useState<BlueskyList | null>(null);

  // Refs for pause/cancel
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isCancelledRef.current = isCancelled;
  }, [isCancelled]);

  // Batch selection context
  const {
    isSelectionMode,
    toggleSelectionMode,
    selectedUsers,
    selectedCount,
    selectAll,
    getEstimation,
    startOperation,
    updateProgress,
    completeOperation,
    cancelOperation,
    failOperation,
    pushUndo,
    popUndo,
    canUndo,
    reset,
    operation,
  } = useBatchSelection();

  // Relationship URIs for unfollow operations
  const [relationshipUris, setRelationshipUris] = useState<Map<string, string>>(
    new Map(),
  );

  // Accessibility
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  // Determine available actions based on modal type and whether viewing own profile
  const isOwnProfile = session?.did === actor;
  const availableActions = useMemo<BatchActionType[]>(() => {
    if (type === "followers" && isOwnProfile) {
      return ["mute", "block", "remove_follower", "add_to_list"];
    }
    if (type === "following" && isOwnProfile) {
      return ["mute", "block", "unfollow", "add_to_list"];
    }
    // For viewing others' followers/following
    return ["mute", "block", "add_to_list"];
  }, [type, isOwnProfile]);

  // Load users
  useEffect(() => {
    if (isOpen && agent) {
      loadUsers(true);
    }
  }, [isOpen, actor, type, agent]);

  // Reset batch state when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setIsPaused(false);
      setIsCancelled(false);
    }
  }, [isOpen, reset]);

  const loadUsers = async (initial = false) => {
    if (!agent || (!initial && (!hasMore || loadingMore))) return;

    try {
      if (initial) {
        setLoading(true);
        setUsers([]);
        setRelationshipUris(new Map());
      } else {
        setLoadingMore(true);
      }

      if (type === "followers") {
        const response = await agent.getFollowers({
          actor,
          limit: 50,
          cursor: initial ? undefined : cursor,
        });

        if (response.data) {
          setUsers((prev) =>
            initial
              ? response.data.followers
              : [...prev, ...response.data.followers],
          );
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        }
      } else {
        const response = await agent.getFollows({
          actor,
          limit: 50,
          cursor: initial ? undefined : cursor,
        });

        if (response.data) {
          const follows = response.data.follows;
          setUsers((prev) => (initial ? follows : [...prev, ...follows]));
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);

          // Store relationship URIs for unfollow operations
          const newUris = new Map(relationshipUris);
          // The follows response includes viewer info with following URI
          for (const follow of follows) {
            // For following list, we need to get the follow record URI
            // This is typically available via the profile's viewer.following
            if ((follow as any).viewer?.following) {
              newUris.set(follow.did, (follow as any).viewer.following);
            }
          }
          setRelationshipUris(newUris);
        }
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleUserClick = useCallback(
    (handle: string) => {
      if (!isSelectionMode) {
        navigate(`/profile/${handle}`);
        onClose();
      }
    },
    [navigate, onClose, isSelectionMode],
  );

  // Use RAF-batched infinite scroll
  const { ref: infiniteScrollRef } = useInfiniteScroll({
    onLoadMore: () => loadUsers(),
    hasMore,
    isLoading: loadingMore,
    threshold: 100,
  });

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Don't handle if selection mode keyboard shortcuts should take over
      if (isSelectionMode && (e.key === "Escape" || e.ctrlKey || e.metaKey)) {
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (users.length > 0) {
            setFocusedIndex((prev) =>
              prev < users.length - 1 ? prev + 1 : prev,
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (users.length > 0) {
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          }
          break;
        case "Enter":
          if (
            !isSelectionMode &&
            focusedIndex >= 0 &&
            focusedIndex < users.length
          ) {
            e.preventDefault();
            handleUserClick(users[focusedIndex].handle);
          }
          break;
        case " ":
          // Space to toggle selection when in selection mode
          if (isSelectionMode && focusedIndex >= 0) {
            e.preventDefault();
            // Selection is handled by UserSelectableRow
          }
          break;
        case "Home":
          if (users.length > 0) {
            e.preventDefault();
            setFocusedIndex(0);
          }
          break;
        case "End":
          if (users.length > 0) {
            e.preventDefault();
            setFocusedIndex(users.length - 1);
          }
          break;
      }
    },
    [users, focusedIndex, onClose, handleUserClick, isSelectionMode],
  );

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allSelectableUsers = users.map((user) =>
      profileToSelectableUser(user, relationshipUris.get(user.did)),
    );
    selectAll(allSelectableUsers);
  }, [users, relationshipUris, selectAll]);

  // Handle batch action selection
  const handleAction = useCallback(async (actionType: BatchActionType) => {
    if (actionType === "add_to_list") {
      // Load lists first
      setLoadingLists(true);
      setShowListDialog(true);
      try {
        const myLists = await blueskyListService.getMyLists();
        setLists(myLists);
      } catch (error) {
        console.error("Failed to load lists:", error);
      } finally {
        setLoadingLists(false);
      }
      return;
    }

    setPendingAction(actionType);
    setShowConfirmDialog(true);
  }, []);

  // Handle list selection for add_to_list
  const handleListSelect = useCallback((list: BlueskyList) => {
    setSelectedList(list);
    setShowListDialog(false);
    setPendingAction("add_to_list");
    setShowConfirmDialog(true);
  }, []);

  // Execute batch operation
  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !agent) return;

    setShowConfirmDialog(false);

    const estimation = getEstimation(pendingAction);
    const selectedArray = Array.from(selectedUsers.values());

    // Start operation
    startOperation(pendingAction, estimation);
    setIsPaused(false);
    setIsCancelled(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;

    try {
      const result = await executeBatchOperation({
        agent,
        users: selectedArray,
        actionType: pendingAction,
        listUri: selectedList?.uri,
        onProgress: updateProgress,
        isPaused: () => isPausedRef.current,
        isCancelled: () => isCancelledRef.current,
      });

      if (result.wasCancelled) {
        cancelOperation();
      } else {
        completeOperation();
        // Push to undo stack for reversible actions
        pushUndo(pendingAction, selectedArray);
      }
    } catch (error) {
      failOperation(error instanceof Error ? error.message : "Unknown error");
    }

    setPendingAction(null);
    setSelectedList(null);
  }, [
    pendingAction,
    agent,
    selectedUsers,
    selectedList,
    getEstimation,
    startOperation,
    updateProgress,
    completeOperation,
    cancelOperation,
    failOperation,
    pushUndo,
  ]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (!agent || !canUndo) return;

    const undoEntry = popUndo();
    if (!undoEntry) return;

    setIsUndoing(true);
    try {
      await executeUndoBatchOperation(
        agent,
        undoEntry.actionType,
        undoEntry.users,
      );
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      setIsUndoing(false);
    }
  }, [agent, canUndo, popUndo]);

  // Handle pause/resume
  const handlePause = useCallback(() => {
    setIsPaused(true);
    isPausedRef.current = true;
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsCancelled(true);
    isCancelledRef.current = true;
    cancelOperation();
  }, [cancelOperation]);

  // Handle progress indicator close
  const handleProgressClose = useCallback(() => {
    reset();
  }, [reset]);

  // Reset focus index when modal opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isOperationActive =
    operation.status === "running" || operation.status === "paused";

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="modal-container modal-auto-height modal-md bg-white dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <h2 id={titleId} className="text-xl font-semibold">
                {title}
              </h2>
              {isSelectionMode && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Select mode
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle selection mode */}
              {users.length > 0 && !isOperationActive && (
                <button
                  onClick={() => toggleSelectionMode()}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelectionMode
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                  title={
                    isSelectionMode
                      ? "Exit selection mode"
                      : "Enter selection mode"
                  }
                  aria-pressed={isSelectionMode}
                >
                  <CheckSquare className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Select</span>
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* User list */}
          <div
            ref={(el) => {
              // Combine refs for keyboard navigation and infinite scroll
              (
                listRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
              infiniteScrollRef(el);
            }}
            className={`asph-scrollbar max-h-[calc(80vh-73px)] overflow-y-auto ${isSelectionMode ? "pb-20" : ""}`}
            role="listbox"
            aria-label={`${title} list`}
            aria-multiselectable={isSelectionMode}
            tabIndex={0}
          >
            {loading ? (
              <div className="flex justify-center p-8" aria-live="polite">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"
                  aria-label="Loading users"
                />
              </div>
            ) : users.length === 0 ? (
              <div
                className="p-8 text-center text-gray-500 dark:text-gray-400"
                role="status"
              >
                No {type} yet
              </div>
            ) : (
              <>
                {users.map((user, index) => (
                  <UserSelectableRow
                    key={user.did}
                    user={user}
                    relationshipUri={relationshipUris.get(user.did)}
                    onClick={handleUserClick}
                    isFocused={index === focusedIndex}
                    index={index}
                  />
                ))}
                {loadingMore && (
                  <div className="flex justify-center p-4" aria-live="polite">
                    <div
                      className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"
                      aria-label="Loading more users"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Batch actions toolbar */}
      <BatchActionsToolbar
        availableActions={availableActions}
        onAction={handleAction}
        onSelectAll={handleSelectAll}
        isUndoing={isUndoing}
        onUndo={handleUndo}
      />

      {/* Confirmation dialog */}
      {pendingAction && (
        <BatchConfirmationDialog
          isOpen={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setPendingAction(null);
            setSelectedList(null);
          }}
          onConfirm={handleConfirm}
          actionType={pendingAction}
          selectedCount={selectedCount}
          estimation={getEstimation(pendingAction)}
          listName={selectedList?.name}
        />
      )}

      {/* List selection dialog */}
      <ListSelectionDialog
        isOpen={showListDialog}
        onClose={() => setShowListDialog(false)}
        onSelect={handleListSelect}
        lists={lists}
        loading={loadingLists}
      />

      {/* Progress indicator */}
      {(operation.status === "running" ||
        operation.status === "paused" ||
        operation.status === "completed" ||
        operation.status === "cancelled" ||
        operation.status === "failed") && (
        <BatchProgressIndicator
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
          onClose={handleProgressClose}
        />
      )}
    </>
  );
};

/**
 * Main component wrapped with BatchSelectionProvider
 */
export function UserListModalWithBatch(props: UserListModalWithBatchProps) {
  return (
    <BatchSelectionProvider>
      <UserListModalInner {...props} />
    </BatchSelectionProvider>
  );
}
