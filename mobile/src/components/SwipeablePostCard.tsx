import React, {useCallback, useRef, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {PostCard} from './PostCard';
import {ReplyIcon, HeartIcon, BookmarkIcon, RepostIcon} from './icons';
import {useTheme} from '../contexts/ThemeContext';
import {usePreferences} from '../contexts/PreferencesContext';
import {useNetwork} from '../contexts/NetworkContext';
import {triggerHaptic} from '../utils/haptics';
import {AppBskyFeedDefs} from '@atproto/api';

interface SwipeablePostCardProps {
  post: AppBskyFeedDefs.FeedViewPost;
  isVisible?: boolean;
  onPress?: () => void;
  onPressProfile?: (handle: string) => void;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  onBlock?: (did: string) => void;
  onMute?: (did: string) => void;
  onReport?: (uri: string, cid: string) => void;
  currentUserDid?: string;
  onPressLikeCount?: () => void;
  onPressRepostCount?: () => void;
  onPressQuoteCount?: () => void;
}

const SWIPE_THRESHOLD = 64;
const ACTION_WIDTH = 72;

function SwipeablePostCardComponent(props: SwipeablePostCardProps) {
  const {colors} = useTheme();
  const {preferences} = usePreferences();
  const {isOnline} = useNetwork();
  const swipeableRef = useRef<Swipeable>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isLiked = !!props.post.post.viewer?.like;
  const swipeEnabled = preferences?.swipeActionsEnabled !== false && isOnline;

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handleSwipeReply = useCallback(() => {
    triggerHaptic('light');
    closeSwipeable();
    props.onReply?.();
  }, [props.onReply, closeSwipeable]);

  const handleSwipeLike = useCallback(() => {
    triggerHaptic('light');
    closeSwipeable();
    props.onLike?.();
  }, [props.onLike, closeSwipeable]);

  const handleSwipeBookmark = useCallback(() => {
    triggerHaptic('light');
    closeSwipeable();
    props.onBookmark?.();
  }, [props.onBookmark, closeSwipeable]);

  const handleSwipeRepost = useCallback(() => {
    triggerHaptic('medium');
    closeSwipeable();
    props.onRepost?.();
  }, [props.onRepost, closeSwipeable]);

  const renderLeftActions = useCallback(
    (_progress: RNAnimated.AnimatedInterpolation<number>, dragX: RNAnimated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [0, SWIPE_THRESHOLD],
        outputRange: [0.5, 1],
        extrapolate: 'clamp',
      });

      const opacity = dragX.interpolate({
        inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
        outputRange: [0, 0.5, 1],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.leftActionsContainer}>
          <RNAnimated.View
            style={[
              styles.leftAction,
              {backgroundColor: colors.reply},
              {transform: [{scale}], opacity},
            ]}>
            <ReplyIcon size={22} color="#FFFFFF" />
            <Text style={styles.actionLabel}>Reply</Text>
          </RNAnimated.View>
        </View>
      );
    },
    [colors.reply, styles],
  );

  const renderRightActions = useCallback(
    (progress: RNAnimated.AnimatedInterpolation<number>, _dragX: RNAnimated.AnimatedInterpolation<number>) => {
      const translateLike = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [ACTION_WIDTH * 3, 0],
        extrapolate: 'clamp',
      });

      const translateBookmark = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [ACTION_WIDTH * 2, 0],
        extrapolate: 'clamp',
      });

      const translateRepost = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [ACTION_WIDTH, 0],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.rightActionsOuter}>
          <RNAnimated.View style={{transform: [{translateX: translateLike}]}}>
            <TouchableOpacity
              onPress={handleSwipeLike}
              activeOpacity={0.7}
              style={[
                styles.rightAction,
                {backgroundColor: isLiked ? colors.textSecondary : colors.like},
              ]}
              accessibilityRole="button"
              accessibilityLabel={isLiked ? 'Unlike' : 'Like'}>
              <HeartIcon size={22} color="#FFFFFF" filled={isLiked} />
              <Text style={styles.actionLabel}>{isLiked ? 'Unlike' : 'Like'}</Text>
            </TouchableOpacity>
          </RNAnimated.View>

          <RNAnimated.View style={{transform: [{translateX: translateBookmark}]}}>
            <TouchableOpacity
              onPress={handleSwipeBookmark}
              activeOpacity={0.7}
              style={[
                styles.rightAction,
                {backgroundColor: props.isBookmarked ? colors.textSecondary : colors.primary},
              ]}
              accessibilityRole="button"
              accessibilityLabel={props.isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
              <BookmarkIcon size={22} color="#FFFFFF" filled={props.isBookmarked} />
              <Text style={styles.actionLabel}>{props.isBookmarked ? 'Unsave' : 'Save'}</Text>
            </TouchableOpacity>
          </RNAnimated.View>

          <RNAnimated.View style={{transform: [{translateX: translateRepost}]}}>
            <TouchableOpacity
              onPress={handleSwipeRepost}
              activeOpacity={0.7}
              style={[styles.rightAction, {backgroundColor: colors.repost}]}
              accessibilityRole="button"
              accessibilityLabel="Repost">
              <RepostIcon size={22} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Repost</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        </View>
      );
    },
    [colors, isLiked, props.isBookmarked, styles, handleSwipeLike, handleSwipeBookmark, handleSwipeRepost],
  );

  const handleSwipeableOpen = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        handleSwipeReply();
      }
    },
    [handleSwipeReply],
  );

  if (!swipeEnabled) {
    return <PostCard {...props} />;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={SWIPE_THRESHOLD}
      rightThreshold={SWIPE_THRESHOLD}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      onSwipeableOpen={handleSwipeableOpen}
      containerStyle={styles.swipeableContainer}>
      <PostCard {...props} />
    </Swipeable>
  );
}

function createStyles(colors: Record<string, string>) {
  return StyleSheet.create({
    swipeableContainer: {
      backgroundColor: colors.background,
    },
    leftActionsContainer: {
      justifyContent: 'center',
      alignItems: 'flex-start',
      width: ACTION_WIDTH,
    },
    leftAction: {
      justifyContent: 'center',
      alignItems: 'center',
      width: ACTION_WIDTH,
      height: '100%',
      paddingHorizontal: 8,
    },
    rightActionsOuter: {
      flexDirection: 'row',
      width: ACTION_WIDTH * 3,
    },
    rightAction: {
      justifyContent: 'center',
      alignItems: 'center',
      width: ACTION_WIDTH,
      height: '100%',
      paddingHorizontal: 8,
    },
    actionLabel: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },
  });
}

function arePropsEqual(
  prevProps: SwipeablePostCardProps,
  nextProps: SwipeablePostCardProps,
): boolean {
  if (prevProps.post.post.uri !== nextProps.post.post.uri) return false;
  if (
    prevProps.post.post.likeCount !== nextProps.post.post.likeCount ||
    prevProps.post.post.repostCount !== nextProps.post.post.repostCount ||
    prevProps.post.post.replyCount !== nextProps.post.post.replyCount ||
    prevProps.post.post.viewer?.like !== nextProps.post.post.viewer?.like ||
    prevProps.post.post.viewer?.repost !== nextProps.post.post.viewer?.repost
  ) {
    return false;
  }
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (prevProps.isBookmarked !== nextProps.isBookmarked) return false;
  if (prevProps.currentUserDid !== nextProps.currentUserDid) return false;

  const prevLabels = prevProps.post.post.labels || [];
  const nextLabels = nextProps.post.post.labels || [];
  if (prevLabels.length !== nextLabels.length) return false;

  return true;
}

export const SwipeablePostCard = React.memo(
  SwipeablePostCardComponent,
  arePropsEqual,
);
