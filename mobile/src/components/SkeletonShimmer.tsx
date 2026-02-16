import React, {useEffect, useRef, useMemo} from 'react';
import {StyleSheet, Animated} from 'react-native';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [shimmerAnimation]);

  const opacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    skeleton: {
      backgroundColor: colors.surface,
    },
  });
}
