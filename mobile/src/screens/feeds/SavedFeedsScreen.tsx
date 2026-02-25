import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../contexts/ThemeContext';
import {PostCardSkeleton} from '../../components/PostCardSkeleton';
import {
  useSavedFeeds,
  useUnsaveFeed,
  usePinFeed,
  useUnpinFeed,
  usePinnedFeeds,
  useReorderSavedFeeds,
} from '../../hooks/api';
import {AppBskyFeedDefs} from '@atproto/api';
import DraggableFlatList, {RenderItemParams, ScaleDecorator} from 'react-native-draggable-flatlist';

interface SavedFeedsScreenProps {
  onClose?: () => void;
}

export function SavedFeedsScreen({onClose}: SavedFeedsScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {data: savedFeedsData, isLoading, isError, refetch} = useSavedFeeds();
  const {data: pinnedFeedUris} = usePinnedFeeds();
  const {mutate: unsaveFeed} = useUnsaveFeed();
  const {mutate: pinFeed} = usePinFeed();
  const {mutate: unpinFeed} = useUnpinFeed();
  const {mutate: reorderFeeds} = useReorderSavedFeeds();

  const pinnedFeedUrisSet = useMemo(() => {
    return new Set(pinnedFeedUris || []);
  }, [pinnedFeedUris]);

  const [localFeeds, setLocalFeeds] = useState<AppBskyFeedDefs.GeneratorView[]>([]);

  // Update local feeds when data changes
  React.useEffect(() => {
    if (savedFeedsData) {
      setLocalFeeds(savedFeedsData);
    }
  }, [savedFeedsData]);

  // Use localFeeds for rendering, but fall back to savedFeedsData to avoid
  // the empty flash before the useEffect runs
  const feeds = localFeeds.length > 0 ? localFeeds : (savedFeedsData ?? []);
  const hasFeeds = feeds.length > 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleFeedPress = (feedUri: string) => {
    router.push({
      pathname: '/(app)/(tabs)/(home)' as any,
      params: {feedUri},
    });
  };

  const handleRemoveFeed = (feedUri: string, feedName: string) => {
    Alert.alert('Remove Feed', `Remove "${feedName}" from your saved feeds?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => unsaveFeed(feedUri),
      },
    ]);
  };

  const handleTogglePin = (feedUri: string) => {
    if (pinnedFeedUrisSet.has(feedUri)) {
      unpinFeed(feedUri);
    } else {
      pinFeed(feedUri);
    }
  };

  const handleToggleReorderMode = () => {
    if (isReorderMode) {
      // Save the new order
      const feedUris = localFeeds.map((feed) => feed.uri);
      reorderFeeds(feedUris);
    }
    setIsReorderMode(!isReorderMode);
  };

  const renderFeedCardContent = (item: AppBskyFeedDefs.GeneratorView, isActive = false, drag?: () => void) => {
    const isPinned = pinnedFeedUrisSet.has(item.uri);
    const likeCount = item.likeCount || 0;

    return (
      <TouchableOpacity
        style={[styles.feedCard, isActive && styles.feedCardDragging]}
        onPress={() => !isReorderMode && handleFeedPress(item.uri)}
        onLongPress={isReorderMode ? drag : undefined}
        disabled={isActive}
        activeOpacity={0.7}>
        <View style={styles.feedHeader}>
          {isReorderMode && (
            <View style={styles.dragHandle}>
              <Text style={styles.dragHandleText}>☰</Text>
            </View>
          )}
          {item.avatar ? (
            <Image source={{uri: item.avatar}} style={styles.feedAvatar} />
          ) : (
            <View style={[styles.feedAvatar, styles.feedAvatarPlaceholder]}>
              <Text style={styles.feedAvatarText}>{item.displayName?.[0] || '📰'}</Text>
            </View>
          )}
          <View style={styles.feedInfo}>
            <Text style={styles.feedName} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={styles.feedCreator} numberOfLines={1}>
              by @{item.creator.handle}
            </Text>
          </View>
          {!isReorderMode && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.pinButton, isPinned && styles.pinButtonActive]}
                onPress={() => handleTogglePin(item.uri)}
                activeOpacity={0.7}>
                <Text style={styles.pinButtonText}>📌</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveFeed(item.uri, item.displayName)}
                activeOpacity={0.7}>
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {item.description && (
          <Text style={styles.feedDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.feedFooter}>
          <Text style={styles.feedLikes}>❤️ {likeCount.toLocaleString()} likes</Text>
          {isPinned && <Text style={styles.pinnedBadge}>📌 Pinned</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDraggableItem = ({item, drag, isActive}: RenderItemParams<AppBskyFeedDefs.GeneratorView>) => (
    <ScaleDecorator>{renderFeedCardContent(item, isActive, drag)}</ScaleDecorator>
  );

  const renderStaticItem = ({item}: {item: AppBskyFeedDefs.GeneratorView}) =>
    renderFeedCardContent(item);

  const renderContent = () => {
    if (isLoading) {
    return (
      <>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </>
    );
  }

    if (isError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Could not load feeds</Text>
          <Text style={styles.emptyStateSubtext}>
            Pull down to retry
          </Text>
        </View>
      );
    }

    if (!hasFeeds) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No saved feeds</Text>
          <Text style={styles.emptyStateSubtext}>
            Visit the Discover tab to find and save feeds
          </Text>
        </View>
      );
    }

    if (isReorderMode) {
      return (
        <DraggableFlatList
          data={feeds}
          renderItem={renderDraggableItem}
          keyExtractor={(item) => item.uri}
          onDragEnd={({data}) => setLocalFeeds(data)}
          contentContainerStyle={styles.listContent}
        />
      );
    }

    return (
      <FlatList
        data={feeds}
        keyboardDismissMode="on-drag"
        renderItem={renderStaticItem}
        keyExtractor={(item) => item.uri}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      />
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Feeds</Text>
        <View style={styles.headerActions}>
          {hasFeeds && (
            <TouchableOpacity onPress={handleToggleReorderMode} style={styles.reorderButton}>
              <Text style={[styles.reorderButtonText, isReorderMode && styles.reorderButtonTextActive]}>
                {isReorderMode ? 'Done' : 'Reorder'}
              </Text>
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {renderContent()}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    reorderButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface,
    },
    reorderButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    reorderButtonTextActive: {
      color: colors.primary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 18,
      color: colors.textSecondary,
    },
    listContent: {
      padding: 12,
    },
    feedCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surface,
    },
    feedCardDragging: {
      opacity: 0.7,
      elevation: 5,
      shadowColor: colors.borderDark,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    feedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    dragHandle: {
      marginRight: 12,
      paddingVertical: 4,
    },
    dragHandleText: {
      fontSize: 20,
      color: colors.textSecondary,
    },
    feedAvatar: {
      width: 48,
      height: 48,
      borderRadius: 8,
      marginRight: 12,
    },
    feedAvatarPlaceholder: {
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    feedAvatarText: {
      fontSize: 24,
    },
    feedInfo: {
      flex: 1,
      marginRight: 12,
    },
    feedName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    feedCreator: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    pinButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface,
      minWidth: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pinButtonText: {
      fontSize: 14,
    },
    removeButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface,
      minWidth: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    feedDescription: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 12,
    },
    feedFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    feedLikes: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    pinnedBadge: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
