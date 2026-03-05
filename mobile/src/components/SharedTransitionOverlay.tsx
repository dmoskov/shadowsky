import React, {useEffect, useCallback} from 'react';
import {StyleSheet, useWindowDimensions, View, Text} from 'react-native';
import {Image} from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSharedTransition} from '../contexts/SharedTransitionContext';
import {useTheme} from '../contexts/ThemeContext';
import {fontSize} from '../utils/typography';
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 1,
};

// Target layout for the post card at the top of the thread screen
const TARGET_PADDING = 16;
const TARGET_AVATAR_SIZE = 44;
const HEADER_HEIGHT = 56; // Stack header height

export function SharedTransitionOverlay() {
  const {width: SCREEN_WIDTH} = useWindowDimensions();
  const {state, completeTransition} = useSharedTransition();
  const {active, sourceLayout, postData} = state;
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);

  const onAnimationComplete = useCallback(() => {
    completeTransition();
  }, [completeTransition]);

  useEffect(() => {
    if (active && sourceLayout) {
      progress.value = 0;
      progress.value = withSpring(1, SPRING_CONFIG, finished => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      });
    } else {
      progress.value = 0;
    }
  }, [active, sourceLayout, progress, onAnimationComplete]);

  // Animated backdrop
  const backdropStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(10, 10, 15, 0)', 'rgba(10, 10, 15, 1)'],
    ),
  }));

  // Animated card container - moves from source position to target
  const cardStyle = useAnimatedStyle(() => {
    if (!sourceLayout) {
      return {opacity: 0};
    }

    const targetY = insets.top + HEADER_HEIGHT;
    const targetX = 0;
    const targetWidth = SCREEN_WIDTH;

    return {
      position: 'absolute',
      left: interpolate(progress.value, [0, 1], [sourceLayout.x, targetX]),
      top: interpolate(progress.value, [0, 1], [sourceLayout.y, targetY]),
      width: interpolate(
        progress.value,
        [0, 1],
        [sourceLayout.width, targetWidth],
      ),
      opacity: interpolate(progress.value, [0, 0.05, 1], [0, 1, 1]),
      overflow: 'hidden' as const,
      borderRadius: interpolate(progress.value, [0, 1], [8, 0]),
    };
  });

  // Animated avatar
  const avatarStyle = useAnimatedStyle(() => {
    if (!sourceLayout) {
      return {opacity: 0};
    }

    const sourceAvatarScale = sourceLayout.width < SCREEN_WIDTH * 0.8 ? 0.85 : 1;

    return {
      width: TARGET_AVATAR_SIZE,
      height: TARGET_AVATAR_SIZE,
      borderRadius: TARGET_AVATAR_SIZE / 2,
      overflow: 'hidden' as const,
      transform: [
        {
          scale: interpolate(
            progress.value,
            [0, 1],
            [sourceAvatarScale, 1],
          ),
        },
      ],
    };
  });

  if (!active || !sourceLayout || !postData) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={backdropStyle} />
      <Animated.View style={cardStyle}>
        <View
          style={[
            styles.cardContent,
            {backgroundColor: colors.cardBackground},
          ]}>
          {/* Author row */}
          <View style={styles.authorRow}>
            <Animated.View style={avatarStyle}>
              {postData.authorAvatar ? (
                <Image
                  source={{uri: postData.authorAvatar}}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    {backgroundColor: colors.borderLight},
                  ]}
                />
              )}
            </Animated.View>
            <View style={styles.authorInfo}>
              {postData.authorName ? (
                <Text
                  style={[styles.authorName, {color: colors.text}]}
                  numberOfLines={1}>
                  {postData.authorName}
                </Text>
              ) : null}
              {postData.authorHandle ? (
                <Text
                  style={[styles.authorHandle, {color: colors.textSecondary}]}
                  numberOfLines={1}>
                  @{postData.authorHandle}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Post text preview */}
          {postData.text ? (
            <Text
              style={[styles.postText, {color: colors.text}]}
              numberOfLines={4}>
              {postData.text}
            </Text>
          ) : null}

          {/* Image thumbnail */}
          {postData.imageThumb ? (
            <View style={styles.imageContainer}>
              <Image
                source={{uri: postData.imageThumb}}
                style={styles.imageThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    padding: TARGET_PADDING,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarImage: {
    width: TARGET_AVATAR_SIZE,
    height: TARGET_AVATAR_SIZE,
    borderRadius: TARGET_AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: TARGET_AVATAR_SIZE,
    height: TARGET_AVATAR_SIZE,
    borderRadius: TARGET_AVATAR_SIZE / 2,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorName: {
    fontSize: fontSize.subheadline,
    fontWeight: '600',
  },
  authorHandle: {
    fontSize: fontSize.footnote,
    marginTop: 1,
  },
  postText: {
    fontSize: fontSize.subheadline,
    lineHeight: 20,
    marginBottom: 8,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  imageThumb: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
});
