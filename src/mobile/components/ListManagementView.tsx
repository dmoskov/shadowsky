/**
 * ListManagementView Component for React Native
 *
 * Displays list members with batch operation support.
 * Features:
 * - Virtualized member list with FlatList
 * - Pull-to-refresh
 * - Batch selection mode
 * - Batch operations (mute, block, remove from list)
 */

import type { AppBskyActorDefs, BskyAgent } from "@atproto/api";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type {
  BatchActionType,
  BatchOperationResult,
} from "../../contexts/BatchSelectionContext";
import {
  BatchSelectionProvider,
  profileToSelectableUser,
  useBatchSelection,
} from "../../contexts/BatchSelectionContext";
import { executeBatchOperation } from "../../services/batch-operation-executor";
import { estimateBatchOperation } from "../../services/batch-rate-limit-estimator";
import { useDynamicType, type ScaledFontFn } from "../hooks/useDynamicType";
import {
  MobileBatchActionsToolbar,
  MobileBatchProgressIndicator,
  MobileUserSelectableRow,
} from "./batch";
import { LoadingFooterShimmer, LoadingOverlayShimmer } from "./SkeletonShimmer";

interface ListManagementViewProps {
  /** Bluesky agent for API calls */
  agent: BskyAgent;
  /** List URI */
  listUri: string;
  /** List name for display */
  listName?: string;
  /** Callback when user is pressed (in non-selection mode) */
  onUserPress?: (handle: string) => void;
  /** Callback to close the view */
  onClose?: () => void;
}

function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#ffffff",
    } as ViewStyle,
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
      backgroundColor: "#ffffff",
    } as ViewStyle,
    backButton: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
    } as ViewStyle,
    backIcon: {
      fontSize: scaledFont(24),
      color: "#0f1419",
    } as TextStyle,
    headerTitle: {
      flex: 1,
      fontSize: scaledFont(18),
      fontWeight: "700",
      color: "#0f1419",
      textAlign: "center",
      marginHorizontal: 8,
    } as TextStyle,
    selectButton: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
    } as ViewStyle,
    selectButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#1d9bf0",
    } as TextStyle,
    list: {
      flex: 1,
    } as ViewStyle,
    listContent: {
      flexGrow: 1,
    } as ViewStyle,
    loadingFooter: {
      paddingVertical: 20,
      alignItems: "center",
    } as ViewStyle,
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      minHeight: 300,
    } as ViewStyle,
    emptyText: {
      fontSize: scaledFont(16),
      color: "#687684",
    } as TextStyle,
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      justifyContent: "center",
      alignItems: "center",
    } as ViewStyle,
  });
}

/**
 * Inner component that uses batch selection context
 */
function ListManagementViewInner({
  agent,
  listUri,
  listName,
  onUserPress,
  onClose,
}: ListManagementViewProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  const [members, setMembers] = useState<AppBskyActorDefs.ProfileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const {
    isSelectionMode,
    toggleSelectionMode,
    selectAll,
    selectedUsers,
    startOperation,
    updateProgress,
    completeOperation,
    failOperation,
    pauseOperation,
    resumeOperation,
    cancelOperation,
    operation,
  } = useBatchSelection();

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Load list members
  const loadMembers = useCallback(
    async (initial = false) => {
      if (!initial && (!hasMore || loadingMore)) return;

      try {
        if (initial) {
          setLoading(true);
          setMembers([]);
          setCursor(undefined);
        } else {
          setLoadingMore(true);
        }

        // Use AT Protocol API directly to get list members
        const response = await agent.app.bsky.graph.getList({
          list: listUri,
          limit: 50,
          cursor: initial ? undefined : cursor,
        });

        if (response.data.items) {
          const profiles = response.data.items.map((item) => item.subject);
          setMembers((prev) => (initial ? profiles : [...prev, ...profiles]));
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        }
      } catch (error) {
        console.error("Error loading list members:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [agent, listUri, cursor, hasMore, loadingMore],
  );

  // Initial load
  useEffect(() => {
    loadMembers(true);
  }, [listUri]);

  // Refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(undefined);
    setHasMore(true);
    loadMembers(true);
  }, [loadMembers]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      loadMembers(false);
    }
  }, [hasMore, loadingMore, loading, loadMembers]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const selectableUsers = members.map((member) =>
      profileToSelectableUser(member),
    );
    selectAll(selectableUsers);
  }, [members, selectAll]);

  // Available actions for list management
  const availableActions: BatchActionType[] = useMemo(
    () => ["mute", "block", "unfollow"],
    [],
  );

  // Handle batch action
  const handleBatchAction = useCallback(
    async (actionType: BatchActionType) => {
      const usersArray = Array.from(selectedUsers.values());
      if (usersArray.length === 0) return;

      // Reset pause/cancel flags
      isPausedRef.current = false;
      isCancelledRef.current = false;

      // Estimate the batch operation
      const estimation = await estimateBatchOperation({
        operationType:
          actionType === "mute" || actionType === "unmute"
            ? "mute"
            : actionType === "block" || actionType === "unblock"
              ? "block"
              : "follow",
        count: usersArray.length,
      });

      // Start operation
      await startOperation(actionType, estimation);

      // Execute batch operation
      try {
        const result = await executeBatchOperation({
          agent,
          users: usersArray,
          actionType,
          onProgress: (progressResult: BatchOperationResult) => {
            updateProgress(progressResult);
          },
          isPaused: () => isPausedRef.current,
          isCancelled: () => isCancelledRef.current,
        });

        if (result.wasCancelled) {
          // Operation was cancelled
          // Context already updated by cancelOperation
        } else {
          completeOperation();
        }

        // Refresh the list after operation
        handleRefresh();
      } catch (error) {
        failOperation(error instanceof Error ? error.message : "Unknown error");
      }
    },
    [
      agent,
      selectedUsers,
      startOperation,
      updateProgress,
      completeOperation,
      failOperation,
      handleRefresh,
    ],
  );

  // Progress controls
  const handlePause = useCallback(() => {
    isPausedRef.current = true;
    pauseOperation();
  }, [pauseOperation]);

  const handleResume = useCallback(() => {
    isPausedRef.current = false;
    resumeOperation();
  }, [resumeOperation]);

  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    cancelOperation();
  }, [cancelOperation]);

  const handleCloseProgress = useCallback(() => {
    completeOperation();
  }, [completeOperation]);

  // Render member item
  const renderMember = useCallback(
    ({ item }: ListRenderItemInfo<AppBskyActorDefs.ProfileView>) => (
      <MobileUserSelectableRow user={item} onPress={onUserPress} />
    ),
    [onUserPress],
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: AppBskyActorDefs.ProfileView) => item.did,
    [],
  );

  // List footer
  const ListFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <LoadingFooterShimmer variant="user" />
      </View>
    );
  }, [loadingMore, styles]);

  // Empty component
  const EmptyComponent = useMemo(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No members in this list</Text>
      </View>
    );
  }, [loading, styles]);

  // Show progress indicator when operation is active
  const showProgress =
    operation.status !== "idle" && operation.status !== "completed";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={12}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {listName || "List"}
        </Text>
        <Pressable
          onPress={() => toggleSelectionMode()}
          style={styles.selectButton}
          hitSlop={12}
        >
          <Text style={styles.selectButtonText}>
            {isSelectionMode ? "Cancel" : "Select"}
          </Text>
        </Pressable>
      </View>

      {/* Member list */}
      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={keyExtractor}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={EmptyComponent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        // Performance optimizations
        windowSize={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        removeClippedSubviews={true}
      />

      {/* Batch actions toolbar */}
      {isSelectionMode && !showProgress && (
        <MobileBatchActionsToolbar
          availableActions={availableActions}
          onAction={handleBatchAction}
          onSelectAll={handleSelectAll}
        />
      )}

      {/* Progress indicator */}
      {showProgress && (
        <MobileBatchProgressIndicator
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
          onClose={handleCloseProgress}
        />
      )}

      {/* Loading overlay */}
      {loading && <LoadingOverlayShimmer rows={6} variant="user" />}
    </View>
  );
}

/**
 * Wrapped component with BatchSelectionProvider
 */
export const ListManagementView: React.FC<ListManagementViewProps> = (
  props,
) => {
  return (
    <BatchSelectionProvider>
      <ListManagementViewInner {...props} />
    </BatchSelectionProvider>
  );
};
