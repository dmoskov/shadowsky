/**
 * FollowersListView Component for React Native
 *
 * Displays followers/following list with batch operation support.
 * Features:
 * - Virtualized list with FlatList
 * - Pull-to-refresh
 * - Infinite scroll
 * - Batch selection mode
 * - Batch operations (mute, block, unfollow, remove)
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

interface FollowersListViewProps {
  /** Bluesky agent for API calls */
  agent: BskyAgent;
  /** Actor DID or handle to fetch followers/following for */
  actor: string;
  /** Type of list to display */
  type: "followers" | "following";
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
      fontSize: scaledFont(18),
      fontWeight: "700",
      color: "#0f1419",
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
function FollowersListViewInner({
  agent,
  actor,
  type,
  onUserPress,
  onClose,
}: FollowersListViewProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  const [users, setUsers] = useState<AppBskyActorDefs.ProfileView[]>([]);
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

  // Load users
  const loadUsers = useCallback(
    async (initial = false) => {
      if (!initial && (!hasMore || loadingMore)) return;

      try {
        if (initial) {
          setLoading(true);
          setUsers([]);
        } else {
          setLoadingMore(true);
        }

        let newUsers: AppBskyActorDefs.ProfileView[];

        if (type === "followers") {
          const response = await agent.getFollowers({
            actor,
            limit: 50,
            cursor: initial ? undefined : cursor,
          });
          newUsers = response.data.followers;
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        } else {
          const response = await agent.getFollows({
            actor,
            limit: 50,
            cursor: initial ? undefined : cursor,
          });
          newUsers = response.data.follows;
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        }

        if (newUsers) {
          setUsers((prev) => (initial ? newUsers : [...prev, ...newUsers]));
        }
      } catch (error) {
        console.error(`Error loading ${type}:`, error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [agent, actor, type, cursor, hasMore, loadingMore],
  );

  // Initial load
  useEffect(() => {
    loadUsers(true);
  }, [agent, actor, type]);

  // Refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(undefined);
    setHasMore(true);
    loadUsers(true);
  }, [loadUsers]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      loadUsers(false);
    }
  }, [hasMore, loadingMore, loading, loadUsers]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const selectableUsers = users.map((user) =>
      profileToSelectableUser(
        user,
        type === "following" ? user.viewer?.following : undefined,
      ),
    );
    selectAll(selectableUsers);
  }, [users, type, selectAll]);

  // Get available actions based on list type
  const availableActions: BatchActionType[] = useMemo(() => {
    if (type === "followers") {
      return ["mute", "block", "remove_follower", "add_to_list"];
    } else {
      return ["mute", "block", "unfollow", "add_to_list"];
    }
  }, [type]);

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

  // Render user item
  const renderUser = useCallback(
    ({ item }: ListRenderItemInfo<AppBskyActorDefs.ProfileView>) => (
      <MobileUserSelectableRow
        user={item}
        relationshipUri={
          type === "following" ? item.viewer?.following : undefined
        }
        onPress={onUserPress}
      />
    ),
    [type, onUserPress],
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
        <Text style={styles.emptyText}>No {type} yet</Text>
      </View>
    );
  }, [loading, type, styles]);

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
        <Text style={styles.headerTitle}>
          {type === "followers" ? "Followers" : "Following"}
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

      {/* User list */}
      <FlatList
        data={users}
        renderItem={renderUser}
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
export const FollowersListView: React.FC<FollowersListViewProps> = (props) => {
  return (
    <BatchSelectionProvider>
      <FollowersListViewInner {...props} />
    </BatchSelectionProvider>
  );
};
