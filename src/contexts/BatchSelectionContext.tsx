import type { AppBskyActorDefs } from "@atproto/api";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type {
  BatchEstimation,
  BatchOperationType,
} from "../services/batch-rate-limit-estimator";
import { estimateBatchOperation } from "../services/batch-rate-limit-estimator";

/**
 * Represents a user that can be selected for batch operations
 */
export interface SelectableUser {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  /** URI of the follow/follower relationship (for unfollow/remove operations) */
  relationshipUri?: string;
}

/**
 * Types of batch actions available
 */
export type BatchActionType =
  | "mute"
  | "unmute"
  | "block"
  | "unblock"
  | "unfollow"
  | "remove_follower"
  | "add_to_list";

/**
 * Status of a batch operation
 */
export type BatchOperationStatus =
  | "idle"
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Result of a single operation within a batch
 */
export interface BatchOperationResult {
  user: SelectableUser;
  success: boolean;
  error?: string;
  timestamp: number;
}

/**
 * State for ongoing batch operation
 */
export interface BatchOperationState {
  status: BatchOperationStatus;
  actionType: BatchActionType | null;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  results: BatchOperationResult[];
  estimation: BatchEstimation | null;
  startTime: number | null;
  /** For undo capability - stores recently completed operations */
  undoStack: Array<{
    actionType: BatchActionType;
    users: SelectableUser[];
    results: BatchOperationResult[];
    timestamp: number;
  }>;
}

/**
 * Context state
 */
interface BatchSelectionState {
  /** Currently selected users */
  selectedUsers: Map<string, SelectableUser>;
  /** Whether multi-select mode is active */
  isSelectionMode: boolean;
  /** Current batch operation state */
  operation: BatchOperationState;
  /** List URI for add-to-list action */
  targetListUri: string | null;
}

/**
 * Actions for the reducer
 */
type BatchSelectionAction =
  | { type: "TOGGLE_SELECTION_MODE"; enabled?: boolean }
  | { type: "SELECT_USER"; user: SelectableUser }
  | { type: "DESELECT_USER"; did: string }
  | { type: "TOGGLE_USER"; user: SelectableUser }
  | { type: "SELECT_ALL"; users: SelectableUser[] }
  | { type: "DESELECT_ALL" }
  | { type: "SET_TARGET_LIST"; listUri: string | null }
  | {
      type: "START_OPERATION";
      actionType: BatchActionType;
      estimation: BatchEstimation;
    }
  | { type: "UPDATE_PROGRESS"; result: BatchOperationResult }
  | { type: "PAUSE_OPERATION" }
  | { type: "RESUME_OPERATION" }
  | { type: "CANCEL_OPERATION" }
  | { type: "COMPLETE_OPERATION" }
  | { type: "FAIL_OPERATION"; error: string }
  | { type: "PUSH_UNDO"; actionType: BatchActionType; users: SelectableUser[] }
  | { type: "POP_UNDO" }
  | { type: "RESET" };

const initialOperationState: BatchOperationState = {
  status: "idle",
  actionType: null,
  totalCount: 0,
  completedCount: 0,
  failedCount: 0,
  results: [],
  estimation: null,
  startTime: null,
  undoStack: [],
};

const initialState: BatchSelectionState = {
  selectedUsers: new Map(),
  isSelectionMode: false,
  operation: initialOperationState,
  targetListUri: null,
};

function batchSelectionReducer(
  state: BatchSelectionState,
  action: BatchSelectionAction,
): BatchSelectionState {
  switch (action.type) {
    case "TOGGLE_SELECTION_MODE": {
      const enabled =
        action.enabled !== undefined ? action.enabled : !state.isSelectionMode;
      return {
        ...state,
        isSelectionMode: enabled,
        // Clear selection when exiting selection mode
        selectedUsers: enabled ? state.selectedUsers : new Map(),
      };
    }

    case "SELECT_USER": {
      const newSelected = new Map(state.selectedUsers);
      newSelected.set(action.user.did, action.user);
      return { ...state, selectedUsers: newSelected };
    }

    case "DESELECT_USER": {
      const newSelected = new Map(state.selectedUsers);
      newSelected.delete(action.did);
      return { ...state, selectedUsers: newSelected };
    }

    case "TOGGLE_USER": {
      const newSelected = new Map(state.selectedUsers);
      if (newSelected.has(action.user.did)) {
        newSelected.delete(action.user.did);
      } else {
        newSelected.set(action.user.did, action.user);
      }
      return { ...state, selectedUsers: newSelected };
    }

    case "SELECT_ALL": {
      const newSelected = new Map(state.selectedUsers);
      for (const user of action.users) {
        newSelected.set(user.did, user);
      }
      return { ...state, selectedUsers: newSelected };
    }

    case "DESELECT_ALL":
      return { ...state, selectedUsers: new Map() };

    case "SET_TARGET_LIST":
      return { ...state, targetListUri: action.listUri };

    case "START_OPERATION":
      return {
        ...state,
        operation: {
          ...state.operation,
          status: "running",
          actionType: action.actionType,
          totalCount: state.selectedUsers.size,
          completedCount: 0,
          failedCount: 0,
          results: [],
          estimation: action.estimation,
          startTime: Date.now(),
        },
      };

    case "UPDATE_PROGRESS": {
      const newResults = [...state.operation.results, action.result];
      return {
        ...state,
        operation: {
          ...state.operation,
          completedCount: state.operation.completedCount + 1,
          failedCount: action.result.success
            ? state.operation.failedCount
            : state.operation.failedCount + 1,
          results: newResults,
        },
      };
    }

    case "PAUSE_OPERATION":
      return {
        ...state,
        operation: { ...state.operation, status: "paused" },
      };

    case "RESUME_OPERATION":
      return {
        ...state,
        operation: { ...state.operation, status: "running" },
      };

    case "CANCEL_OPERATION":
      return {
        ...state,
        operation: { ...state.operation, status: "cancelled" },
      };

    case "COMPLETE_OPERATION":
      return {
        ...state,
        operation: { ...state.operation, status: "completed" },
        selectedUsers: new Map(), // Clear selection after completion
        isSelectionMode: false,
      };

    case "FAIL_OPERATION":
      return {
        ...state,
        operation: { ...state.operation, status: "failed" },
      };

    case "PUSH_UNDO": {
      const undoEntry = {
        actionType: action.actionType,
        users: action.users,
        results: state.operation.results.filter((r) => r.success),
        timestamp: Date.now(),
      };
      // Keep only last 5 undo entries
      const newUndoStack = [undoEntry, ...state.operation.undoStack].slice(
        0,
        5,
      );
      return {
        ...state,
        operation: { ...state.operation, undoStack: newUndoStack },
      };
    }

    case "POP_UNDO": {
      const [, ...remainingUndo] = state.operation.undoStack;
      return {
        ...state,
        operation: { ...state.operation, undoStack: remainingUndo },
      };
    }

    case "RESET":
      return {
        ...initialState,
        operation: {
          ...initialOperationState,
          undoStack: state.operation.undoStack,
        },
      };

    default:
      return state;
  }
}

/**
 * Context interface
 */
interface BatchSelectionContextType {
  // State
  selectedUsers: Map<string, SelectableUser>;
  selectedCount: number;
  isSelectionMode: boolean;
  operation: BatchOperationState;
  targetListUri: string | null;

  // Selection actions
  toggleSelectionMode: (enabled?: boolean) => void;
  selectUser: (user: SelectableUser) => void;
  deselectUser: (did: string) => void;
  toggleUser: (user: SelectableUser) => void;
  selectAll: (users: SelectableUser[]) => void;
  deselectAll: () => void;
  isSelected: (did: string) => boolean;

  // List target
  setTargetList: (listUri: string | null) => void;

  // Operation helpers
  getEstimation: (actionType: BatchActionType) => BatchEstimation;
  canPerformAction: (actionType: BatchActionType) => boolean;

  // Operation control (actual execution is handled by parent components)
  startOperation: (
    actionType: BatchActionType,
    estimation: BatchEstimation,
  ) => void;
  updateProgress: (result: BatchOperationResult) => void;
  pauseOperation: () => void;
  resumeOperation: () => void;
  cancelOperation: () => void;
  completeOperation: () => void;
  failOperation: (error: string) => void;

  // Undo
  pushUndo: (actionType: BatchActionType, users: SelectableUser[]) => void;
  popUndo: () =>
    | {
        actionType: BatchActionType;
        users: SelectableUser[];
        results: BatchOperationResult[];
      }
    | undefined;
  canUndo: boolean;

  // Reset
  reset: () => void;
}

const BatchSelectionContext = createContext<
  BatchSelectionContextType | undefined
>(undefined);

/**
 * Provider component for batch selection state
 */
export const BatchSelectionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [state, dispatch] = useReducer(batchSelectionReducer, initialState);

  // Memoized selection helpers
  const selectedCount = useMemo(
    () => state.selectedUsers.size,
    [state.selectedUsers],
  );

  const isSelected = useCallback(
    (did: string) => state.selectedUsers.has(did),
    [state.selectedUsers],
  );

  // Selection actions
  const toggleSelectionMode = useCallback((enabled?: boolean) => {
    dispatch({ type: "TOGGLE_SELECTION_MODE", enabled });
  }, []);

  const selectUser = useCallback((user: SelectableUser) => {
    dispatch({ type: "SELECT_USER", user });
  }, []);

  const deselectUser = useCallback((did: string) => {
    dispatch({ type: "DESELECT_USER", did });
  }, []);

  const toggleUser = useCallback((user: SelectableUser) => {
    dispatch({ type: "TOGGLE_USER", user });
  }, []);

  const selectAll = useCallback((users: SelectableUser[]) => {
    dispatch({ type: "SELECT_ALL", users });
  }, []);

  const deselectAll = useCallback(() => {
    dispatch({ type: "DESELECT_ALL" });
  }, []);

  const setTargetList = useCallback((listUri: string | null) => {
    dispatch({ type: "SET_TARGET_LIST", listUri });
  }, []);

  // Map batch action type to rate limiter operation type
  const mapActionToOperationType = useCallback(
    (actionType: BatchActionType): BatchOperationType => {
      switch (actionType) {
        case "mute":
          return "mute";
        case "unmute":
          return "unmute";
        case "block":
          return "block";
        case "unblock":
          return "unblock";
        case "unfollow":
        case "remove_follower":
          return "unfollow";
        case "add_to_list":
          return "follow"; // List operations use similar rate limits
        default:
          return "follow";
      }
    },
    [],
  );

  const getEstimation = useCallback(
    (actionType: BatchActionType): BatchEstimation => {
      return estimateBatchOperation({
        operationType: mapActionToOperationType(actionType),
        count: state.selectedUsers.size,
      });
    },
    [state.selectedUsers.size, mapActionToOperationType],
  );

  const canPerformAction = useCallback(
    (actionType: BatchActionType): boolean => {
      if (state.selectedUsers.size === 0) return false;
      if (
        state.operation.status === "running" ||
        state.operation.status === "paused"
      ) {
        return false;
      }
      const estimation = getEstimation(actionType);
      return estimation.canProceed;
    },
    [state.selectedUsers.size, state.operation.status, getEstimation],
  );

  // Operation control
  const startOperation = useCallback(
    (actionType: BatchActionType, estimation: BatchEstimation) => {
      dispatch({ type: "START_OPERATION", actionType, estimation });
    },
    [],
  );

  const updateProgress = useCallback((result: BatchOperationResult) => {
    dispatch({ type: "UPDATE_PROGRESS", result });
  }, []);

  const pauseOperation = useCallback(() => {
    dispatch({ type: "PAUSE_OPERATION" });
  }, []);

  const resumeOperation = useCallback(() => {
    dispatch({ type: "RESUME_OPERATION" });
  }, []);

  const cancelOperation = useCallback(() => {
    dispatch({ type: "CANCEL_OPERATION" });
  }, []);

  const completeOperation = useCallback(() => {
    dispatch({ type: "COMPLETE_OPERATION" });
  }, []);

  const failOperation = useCallback((error: string) => {
    dispatch({ type: "FAIL_OPERATION", error });
  }, []);

  // Undo functionality
  const pushUndo = useCallback(
    (actionType: BatchActionType, users: SelectableUser[]) => {
      dispatch({ type: "PUSH_UNDO", actionType, users });
    },
    [],
  );

  const popUndo = useCallback(() => {
    const entry = state.operation.undoStack[0];
    if (entry) {
      dispatch({ type: "POP_UNDO" });
    }
    return entry;
  }, [state.operation.undoStack]);

  const canUndo = useMemo(
    () => state.operation.undoStack.length > 0,
    [state.operation.undoStack],
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Keyboard shortcut handler for selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an editable context
      const activeElement = document.activeElement as HTMLElement | null;
      const isEditable =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;

      if (isEditable) return;

      // Escape to exit selection mode
      if (e.key === "Escape" && state.isSelectionMode) {
        e.preventDefault();
        toggleSelectionMode(false);
        return;
      }

      // Only handle shortcuts when selection mode is active
      if (!state.isSelectionMode) return;

      // Ctrl/Cmd + A to select all (needs to be handled by parent component)
      // Ctrl/Cmd + D to deselect all
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        deselectAll();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isSelectionMode, toggleSelectionMode, deselectAll]);

  const contextValue: BatchSelectionContextType = useMemo(
    () => ({
      selectedUsers: state.selectedUsers,
      selectedCount,
      isSelectionMode: state.isSelectionMode,
      operation: state.operation,
      targetListUri: state.targetListUri,
      toggleSelectionMode,
      selectUser,
      deselectUser,
      toggleUser,
      selectAll,
      deselectAll,
      isSelected,
      setTargetList,
      getEstimation,
      canPerformAction,
      startOperation,
      updateProgress,
      pauseOperation,
      resumeOperation,
      cancelOperation,
      completeOperation,
      failOperation,
      pushUndo,
      popUndo,
      canUndo,
      reset,
    }),
    [
      state.selectedUsers,
      selectedCount,
      state.isSelectionMode,
      state.operation,
      state.targetListUri,
      toggleSelectionMode,
      selectUser,
      deselectUser,
      toggleUser,
      selectAll,
      deselectAll,
      isSelected,
      setTargetList,
      getEstimation,
      canPerformAction,
      startOperation,
      updateProgress,
      pauseOperation,
      resumeOperation,
      cancelOperation,
      completeOperation,
      failOperation,
      pushUndo,
      popUndo,
      canUndo,
      reset,
    ],
  );

  return (
    <BatchSelectionContext.Provider value={contextValue}>
      {children}
    </BatchSelectionContext.Provider>
  );
};

/**
 * Hook to access batch selection context
 */
export function useBatchSelection() {
  const context = useContext(BatchSelectionContext);
  if (!context) {
    throw new Error(
      "useBatchSelection must be used within a BatchSelectionProvider",
    );
  }
  return context;
}

/**
 * Convert a ProfileView to SelectableUser
 */
export function profileToSelectableUser(
  profile: AppBskyActorDefs.ProfileView,
  relationshipUri?: string,
): SelectableUser {
  return {
    did: profile.did,
    handle: profile.handle,
    displayName: profile.displayName,
    avatar: profile.avatar,
    relationshipUri,
  };
}
