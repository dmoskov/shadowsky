import React, {useCallback} from 'react';
import {StyleSheet, Dimensions} from 'react-native';
import {Image} from 'expo-image';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface ImageCarouselItemProps {
  uri: string;
  alt?: string;
  onDismiss: () => void;
  isActive: boolean;
}

export function ImageCarouselItem({
  uri,
  alt,
  onDismiss,
  isActive,
}: ImageCarouselItemProps) {
  // Shared values for zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Reset zoom when not active
  React.useEffect(() => {
    if (!isActive) {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [isActive]);

  const clampTranslation = useCallback((scaleValue: number, transX: number, transY: number) => {
    'worklet';
    // Calculate max translation based on zoom level
    const maxTranslateX = ((SCREEN_WIDTH * scaleValue - SCREEN_WIDTH) / 2) / scaleValue;
    const maxTranslateY = ((SCREEN_HEIGHT * scaleValue - SCREEN_HEIGHT) / 2) / scaleValue;

    return {
      x: Math.max(-maxTranslateX, Math.min(maxTranslateX, transX)),
      y: Math.max(-maxTranslateY, Math.min(maxTranslateY, transY)),
    };
  }, []);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      // Snap back to 1x if close
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture for panning when zoomed or dismissing when not zoomed
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        // Pan when zoomed
        const newTranslateX = savedTranslateX.value + e.translationX / scale.value;
        const newTranslateY = savedTranslateY.value + e.translationY / scale.value;
        const clamped = clampTranslation(scale.value, newTranslateX, newTranslateY);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      } else {
        // Allow vertical pan for dismissal
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        // Save pan position when zoomed
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        // Dismiss gesture when not zoomed
        const shouldDismiss = Math.abs(e.translationY) > 100 || Math.abs(e.velocityY) > 500;
        if (shouldDismiss) {
          runOnJS(onDismiss)();
        } else {
          translateY.value = withSpring(0);
        }
      }
    });

  // Double tap gesture to toggle zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x at tap location
        const newScale = 2;
        const tapX = e.x - SCREEN_WIDTH / 2;
        const tapY = e.y - SCREEN_HEIGHT / 2;

        scale.value = withSpring(newScale);
        savedScale.value = newScale;

        // Center on tap location
        const newTranslateX = -tapX / newScale;
        const newTranslateY = -tapY / newScale;
        const clamped = clampTranslation(newScale, newTranslateX, newTranslateY);

        translateX.value = withSpring(clamped.x);
        translateY.value = withSpring(clamped.y);
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      }
    });

  // Combine all gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, panGesture),
    pinchGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {scale: scale.value},
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <Image
          source={{uri}}
          style={styles.image}
          contentFit="contain"
          transition={200}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
