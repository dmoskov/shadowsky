import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import {useStarterPack, useFollowAllFromStarterPack} from '../../hooks/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import { AppBskyGraphDefs } from '@atproto/api';
import { colors } from '../../constants/theme';
import {Avatar} from '../../components/Avatar';


import { createLogger } from '../../utils/logger';

const logger = createLogger('Starterpackdetailscreenx');
interface StarterPackDetailScreenProps {
  starterPackUri: string;
  onNavigateToProfile?: (handle: string) => void;
}

interface MemberItemProps {
  member: AppBskyGraphDefs.ListItemView;
  onProfilePress: (handle: string) => void;
}

function MemberItem({member, onProfilePress}: MemberItemProps) {
  const subject = member.subject;

  return (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={() => onProfilePress(subject.handle)}>
      <Avatar uri={subject.avatar} size={48} />
      <View style={styles.memberInfo}>
        <Text style={styles.displayName}>
          {subject.displayName || subject.handle}
        </Text>
        <Text style={styles.handle}>@{subject.handle}</Text>
        {subject.description && (
          <Text style={styles.memberDescription} numberOfLines={2}>
            {subject.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface FeedItemProps {
  feed: any; // AppBskyFeedDefs.GeneratorView type
  onPress: () => void;
}

function FeedItem({feed, onPress}: FeedItemProps) {
  return (
    <TouchableOpacity style={styles.feedItem} onPress={onPress}>
      {feed.avatar && (
        <Image source={{uri: feed.avatar}} style={styles.feedAvatar} />
      )}
      <View style={styles.feedInfo}>
        <Text style={styles.feedName}>{feed.displayName}</Text>
        <Text style={styles.feedDescription} numberOfLines={2}>
          {feed.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function StarterPackDetailScreen({
  starterPackUri,
  onNavigateToProfile,
}: StarterPackDetailScreenProps) {
  const {data: starterPack, isLoading, error, refetch} = useStarterPack(starterPackUri);
  const followAllMutation = useFollowAllFromStarterPack();
  const {router} = useAppNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleProfilePress = (handle: string) => {
    if (onNavigateToProfile) {
      onNavigateToProfile(handle);
    } else {
      router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
    }
  };

  const handleFollowAll = async () => {
    if (!starterPack?.listItemsSample) {
      Alert.alert('Error', 'No members to follow');
      return;
    }

    const dids = starterPack.listItemsSample.map(item => item.subject.did);

    Alert.alert(
      'Follow All',
      `Are you sure you want to follow all ${dids.length} members in this starter pack?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Follow All',
          style: 'default',
          onPress: async () => {
            try {
              const result = await followAllMutation.mutateAsync(dids);

              if (result.failed > 0) {
                Alert.alert(
                  'Partially Completed',
                  `Successfully followed ${result.success} members. ${result.failed} follows failed and will be retried.`
                );
              } else {
                Alert.alert('Success', `Successfully followed all ${result.success} members!`);
              }
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to follow all members'
              );
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !starterPack) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load starter pack</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const record = starterPack.record as any;
  const description = record?.description || '';
  const name = record?.name || 'Starter Pack';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>

        {/* Creator Info */}
        <TouchableOpacity
          style={styles.creatorContainer}
          onPress={() => handleProfilePress(starterPack.creator.handle)}>
          <Avatar uri={starterPack.creator.avatar} size={40} />
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorLabel}>Created by</Text>
            <Text style={styles.creatorName}>
              {starterPack.creator.displayName || starterPack.creator.handle}
            </Text>
            <Text style={styles.creatorHandle}>@{starterPack.creator.handle}</Text>
          </View>
        </TouchableOpacity>

        {/* Description */}
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          {starterPack.joinedWeekCount !== undefined && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{starterPack.joinedWeekCount}</Text>
              <Text style={styles.statLabel}>Joined This Week</Text>
            </View>
          )}
          {starterPack.joinedAllTimeCount !== undefined && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{starterPack.joinedAllTimeCount}</Text>
              <Text style={styles.statLabel}>Total Joined</Text>
            </View>
          )}
        </View>

        {/* Follow All Button */}
        {starterPack.listItemsSample && starterPack.listItemsSample.length > 0 && (
          <TouchableOpacity
            style={styles.followAllButton}
            onPress={handleFollowAll}
            disabled={followAllMutation.isPending}>
            {followAllMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.followAllButtonText}>
                Follow All ({starterPack.listItemsSample.length})
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Feeds Section */}
      {starterPack.feeds && starterPack.feeds.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Feeds</Text>
          {starterPack.feeds.map((feed, index) => (
            <FeedItem
              key={feed.uri || index}
              feed={feed}
              onPress={() => {
                // Navigate to feed detail if implemented
                logger.log('Navigate to feed:', feed.uri);
              }}
            />
          ))}
        </View>
      )}

      {/* Members Section */}
      {starterPack.listItemsSample && starterPack.listItemsSample.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({starterPack.list?.listItemCount || starterPack.listItemsSample.length})
          </Text>
          {starterPack.listItemsSample.map((member, index) => (
            <MemberItem
              key={member.uri || index}
              member={member}
              onProfilePress={handleProfilePress}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
  },
  creatorInfo: {
    marginLeft: 12,
    flex: 1,
  },
  creatorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  creatorHandle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  description: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  followAllButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  followAllButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  handle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  feedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  feedInfo: {
    marginLeft: 12,
    flex: 1,
  },
  feedName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  feedDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
