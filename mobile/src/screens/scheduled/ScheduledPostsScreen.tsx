import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useScheduledPosts } from '../../hooks/useScheduledPosts';
import { ScheduledPostItem } from '../../components/ScheduledPostItem';
import { EditScheduledPostModal } from '../../components/EditScheduledPostModal';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ScheduledPost } from '../../services/scheduled-posts';
import { colors } from '../../constants/theme';

export function ScheduledPostsScreen() {
  const { posts, isLoading, error, refetch, updatePost, deletePost } = useScheduledPosts();
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleEdit = (post: ScheduledPost) => {
    setEditingPost(post);
  };

  const handleSaveEdit = async (text: string) => {
    if (!editingPost) return;

    try {
      await updatePost(editingPost.id, { text });
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update post'
      );
    }
  };

  const handleDelete = (post: ScheduledPost) => {
    Alert.alert(
      'Cancel Scheduled Post',
      'Are you sure you want to cancel this scheduled post?',
      [
        {
          text: 'Keep',
          style: 'cancel',
        },
        {
          text: 'Cancel Post',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete post'
              );
            }
          },
        },
      ]
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error.message || 'Failed to load scheduled posts'}
          onRetry={refetch}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ScheduledPostItem post={item} onEdit={handleEdit} onDelete={handleDelete} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState message="No scheduled posts yet. Your queued posts will appear here." />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : undefined}
      />

      <EditScheduledPostModal
        visible={editingPost !== null}
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
  },
});
