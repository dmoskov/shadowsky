import React from 'react';
import Animated, {FadeIn} from 'react-native-reanimated';
import {ViewStyle, StyleProp} from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeInView({
  children,
  delay = 0,
  duration = 200,
  style,
}: FadeInViewProps) {
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(duration)}
      style={style}>
      {children}
    </Animated.View>
  );
}
