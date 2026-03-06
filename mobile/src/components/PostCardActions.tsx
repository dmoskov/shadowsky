import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Animated from 'react-native-reanimated';
import {AppBskyFeedDefs} from '@atproto/api';
import {ReplyIcon, RepostIcon, HeartIcon, BookmarkIcon, SendIcon} from './icons';
import {fontSize} from '../utils/typography';

interface PostCardActionsProps {
  postView: AppBskyFeedDefs.PostView;
  colors: any;
  isOnline: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  likeAnimStyle: any;
  repostAnimStyle: any;
  bookmarkAnimStyle: any;
  onReply?: () => void;
  handleRepostPress: () => void;
  onPressRepostCount?: () => void;
  handleLikePress: () => void;
  onPressLikeCount?: () => void;
  handleBookmarkPress: () => void;
  handleBookmarkLongPress: () => void;
  handleShare: () => void;
}

export function PostCardActions({
  postView,
  colors,
  isOnline,
  isLiked,
  isBookmarked,
  likeAnimStyle,
  repostAnimStyle,
  bookmarkAnimStyle,
  onReply,
  handleRepostPress,
  onPressRepostCount,
  handleLikePress,
  onPressLikeCount,
  handleBookmarkPress,
  handleBookmarkLongPress,
  handleShare,
}: PostCardActionsProps) {
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.engagementBar}>
      <View style={styles.engagementButton}>
        <TouchableOpacity
          onPress={onReply}
          activeOpacity={0.7}
          disabled={!isOnline}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`Reply. ${postView.replyCount || 0} replies`}
          accessibilityHint="Double tap to reply to this post"
          accessibilityState={{disabled: !isOnline}}>
          <ReplyIcon size={18} color={isOnline ? colors.textSecondary : colors.borderLight} />
        </TouchableOpacity>
        <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
          {postView.replyCount || 0}
        </Text>
      </View>

      <View style={styles.engagementButton}>
        <TouchableOpacity
          onPress={handleRepostPress}
          activeOpacity={0.7}
          disabled={!isOnline}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`Repost. ${postView.repostCount || 0} reposts`}
          accessibilityHint="Double tap to repost this post"
          accessibilityState={{disabled: !isOnline}}>
          <Animated.View style={repostAnimStyle}>
            <RepostIcon size={18} color={isOnline ? colors.textSecondary : colors.borderLight} />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPressRepostCount}
          disabled={!onPressRepostCount || (postView.repostCount || 0) === 0}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${postView.repostCount || 0} reposts`}
          accessibilityHint="Double tap to view who reposted">
          <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
            {postView.repostCount || 0}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.engagementButton}>
        <TouchableOpacity
          onPress={handleLikePress}
          activeOpacity={0.7}
          disabled={!isOnline}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}. ${postView.likeCount || 0} likes`}
          accessibilityHint={`Double tap to ${isLiked ? 'remove like from' : 'like'} this post`}
          accessibilityState={{disabled: !isOnline, selected: isLiked}}>
          <Animated.View style={likeAnimStyle}>
            <HeartIcon
              size={18}
              color={isOnline ? (isLiked ? colors.danger : colors.textSecondary) : colors.borderLight}
              filled={isLiked}
            />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPressLikeCount}
          disabled={!onPressLikeCount || (postView.likeCount || 0) === 0}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${postView.likeCount || 0} likes`}
          accessibilityHint="Double tap to view who liked">
          <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
            {postView.likeCount || 0}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.engagementButton}
        onPress={handleBookmarkPress}
        onLongPress={handleBookmarkLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
        disabled={!isOnline}
        accessibilityRole="button"
        accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
        accessibilityHint={`Double tap to ${isBookmarked ? 'remove' : 'add'} bookmark. Long press to save to collection.`}
        accessibilityState={{disabled: !isOnline, selected: isBookmarked}}>
        <Animated.View style={bookmarkAnimStyle}>
          <BookmarkIcon
            size={18}
            color={isOnline ? (isBookmarked ? colors.primary : colors.textSecondary) : colors.borderLight}
            filled={isBookmarked}
          />
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.engagementButton}
        onPress={handleShare}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Share post"
        accessibilityHint="Double tap to share this post">
        <SendIcon size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    engagementBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 8,
    },
    engagementButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    engagementCount: {
      color: colors.textSecondary,
      fontSize: fontSize.footnote,
    },
    disabled: {
      color: colors.borderLight,
      opacity: 0.5,
    },
  });
}
