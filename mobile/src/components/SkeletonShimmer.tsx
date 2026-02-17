import React, {useCallback, useEffect, useState} from 'react';
import {View} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import {useTheme} from '../contexts/ThemeContext';

interface SkeletonShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonShimmer({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonShimmerProps) {
  const {colors, isDark} = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const translateX = useSharedValue(0);

  const onLayout = useCallback(
    (e: {nativeEvent: {layout: {width: number}}}) => {
      setLayoutWidth(e.nativeEvent.layout.width);
    },
    [],
  );

  useEffect(() => {
    if (layoutWidth === 0) return;

    const highlightWidth = layoutWidth * 0.6;
    const startX = -highlightWidth;
    const endX = layoutWidth;

    translateX.value = startX;
    translateX.value = withRepeat(
      withSequence(
        withTiming(endX, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
        }),
        withDelay(
          300,
          withTiming(startX, {duration: 0}),
        ),
      ),
      -1,
    );
  }, [translateX, layoutWidth]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const highlightColor = isDark
    ? 'rgba(255, 255, 255, 0.07)'
    : 'rgba(255, 255, 255, 0.55)';

  const highlightWidth = Math.max(layoutWidth * 0.6, 1);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        style,
      ]}
      onLayout={onLayout}>
      {layoutWidth > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: highlightWidth,
              backgroundColor: highlightColor,
              borderRadius,
            },
            highlightStyle,
          ]}
        />
      )}
    </View>
  );
}
