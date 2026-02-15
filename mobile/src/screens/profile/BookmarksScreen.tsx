import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, TextInput } from 'react-native';
import { FeedList } from '../../components/FeedList';
import { useBookmarks } from '../../hooks/api';
import { AppBskyFeedDefs } from '@atproto/api';
import { useRouter } from 'expo-router';
import { triggerHaptic } from '../../../src/utils/haptics';
import { useCollectionBookmarks } from '../../hooks/useBookmarkCollections';
import { CollectionManager } from '../../components/CollectionManager';
import { colors } from '../../constants/theme';
import { useThreadSummaryPreGeneration } from '../../hooks/useThreadSummaryPreGeneration';
import { usePreferences } from '../../contexts/PreferencesContext';

export function BookmarksScreen() {
  const router = useRouter();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { preferences } = usePreferences();
  useThreadSummaryPreGeneration({ enabled: preferences?.enableThreadSummaryPreGen });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use collection-based bookmarks
  const {
    bookmarks: collectionBookmarks,
    isLoading,
    error,
    refetch,
  } = useCollectionBookmarks(selectedCollectionId);

  // Convert BookmarkPost[] to FeedViewPost[] and apply search filter
  const feedPosts: AppBskyFeedDefs.FeedViewPost[] = collectionBookmarks
    .filter((bookmark) => {
      if (!bookmark.post) return false;
      if (!searchQuery) return true;

      // Search in post text and author
      const post = bookmark.post;
      const searchLower = searchQuery.toLowerCase();
      const postText = ('text' in post.record ? (post.record.text as string) : '').toLowerCase();
      const authorName = post.author.displayName?.toLowerCase() || '';
      const authorHandle = post.author.handle.toLowerCase();

      return (
        postText.includes(searchLower) ||
        authorName.includes(searchLower) ||
        authorHandle.includes(searchLower)
      );
    })
    .map((bookmark) => ({
      post: bookmark.post!,
      reason: undefined,
      reply: undefined,
      feedContext: undefined,
    }));

  const handlePostPress = (post: AppBskyFeedDefs.FeedViewPost) => {
    // Navigate to post detail
    router.push({
      pathname: '/post/[uri]' as never,
      params: { uri: encodeURIComponent(post.post.uri) },
    } as never);
  };

  const handleProfilePress = (handle: string) => {
    // Navigate to profile
    router.push({
      pathname: '/profile/[handle]' as never,
      params: { handle },
    } as never);
  };

  const handleBookmark = (post: AppBskyFeedDefs.FeedViewPost) => {
    triggerHaptic("light");
    toggleBookmark(post.post);
  };

  const handleMentionPress = (handle: string, _did: string) => {
    handleProfilePress(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({ pathname: '/(app)/(tabs)/(search)' as any, params: { q: '#' + tag } });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Collection Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => setShowCollectionManager(true)}
          style={styles.collectionButton}
        >
          <Text style={styles.collectionButtonText}>
            {selectedCollectionId === null
              ? '📁 All Bookmarks'
              : selectedCollectionId === '__uncategorized__'
              ? '📁 Uncategorized'
              : '📁 Collection'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search bookmarks..."
          placeholderTextColor={colors.textSecondary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FeedList
        posts={feedPosts}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        onRefresh={handleRefresh}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        emptyMessage={
          searchQuery
            ? 'No bookmarks match your search.'
            : 'No bookmarks yet. Bookmark posts to see them here.'
        }
      />

      {/* Collection Manager Modal */}
      <Modal
        visible={showCollectionManager}
        animationType="slide"
        onRequestClose={() => setShowCollectionManager(false)}
      >
        <CollectionManager
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={(id) => {
            setSelectedCollectionId(id);
            setShowCollectionManager(false);
          }}
          onClose={() => setShowCollectionManager(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  collectionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collectionButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    fontSize: 14,
    color: colors.text,
  },
  clearButton: {
    position: 'absolute',
    right: 24,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
