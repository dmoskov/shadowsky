import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDrafts, useDeleteDraft } from '../../hooks/api';
import { EnrichedDraft } from '../../services/drafts';
import { useTheme } from '../../contexts/ThemeContext';
import { CloseIcon } from '../../components/icons';
import { PostCardSkeleton } from '../../components/PostCardSkeleton';
import { triggerHaptic } from '../../utils/haptics';

/**
 * DraftsScreen - List and manage all saved drafts
 */
export function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useDrafts();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deleteDraft = useDeleteDraft();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Flatten all pages of drafts
  const drafts = data?.pages.flatMap((page) => page.drafts) || [];

  const handleDraftPress = (draft: EnrichedDraft) => {
    // Navigate to compose screen with draft data
    router.push({
      pathname: '/(app)/compose',
      params: { draftId: draft.id },
    });
  };

  const handleDeleteDraft = (draft: EnrichedDraft) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDraft.mutate(draft.id);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderDraftItem = ({ item }: { item: EnrichedDraft }) => {
    const firstPost = item.draft.posts?.[0];
    const previewText = firstPost?.text || '(No text)';
    const imageCount = firstPost?.embedImages?.length || 0;
    const videoCount = firstPost?.embedVideos?.length || 0;
    const postCount = item.draft.posts?.length || 0;

    // Check if this draft was created on another device
    const isFromAnotherDevice = !item.hasLocalMedia && (imageCount > 0 || videoCount > 0);

    return (
      <TouchableOpacity
        style={styles.draftItem}
        onPress={() => handleDraftPress(item)}
        onLongPress={() => { triggerHaptic("medium"); handleDeleteDraft(item); }}
      >
        <View style={styles.draftContent}>
          <Text style={styles.draftPreview} numberOfLines={2}>
            {previewText}
          </Text>

          <View style={styles.draftMeta}>
            <View style={styles.draftMetaRow}>
              {postCount > 1 && (
                <Text style={styles.draftMetaText}>
                  {postCount} posts
                </Text>
              )}
              {imageCount > 0 && (
                <Text style={styles.draftMetaText}>
                  {imageCount} {imageCount === 1 ? 'image' : 'images'}
                </Text>
              )}
              {videoCount > 0 && (
                <Text style={styles.draftMetaText}>
                  {videoCount} {videoCount === 1 ? 'video' : 'videos'}
                </Text>
              )}
            </View>

            {item.draft.deviceName && (
              <Text style={styles.deviceName} numberOfLines={1}>
                From: {item.draft.deviceName}
              </Text>
            )}

            {isFromAnotherDevice && (
              <Text style={styles.warningText}>
                ⚠️ Media created on another device ({item.missingMediaCount} missing)
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteDraft(item)}
        >
          <CloseIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    triggerHaptic('selection');
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </>
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <CloseIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drafts</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Drafts List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyboardDismissMode="on-drag"
          renderItem={renderDraftItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
        />
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerRight: {
      width: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      flexGrow: 1,
    },
    draftItem: {
      flexDirection: 'row',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'flex-start',
    },
    draftContent: {
      flex: 1,
      marginRight: 12,
    },
    draftPreview: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 8,
    },
    draftMeta: {
      gap: 4,
    },
    draftMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    draftMetaText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    deviceName: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    warningText: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 4,
    },
    deleteButton: {
      padding: 8,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
  });
}
