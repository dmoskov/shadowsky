import React, {useRef} from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MAX_ZOOM = 5;
const MIN_ZOOM = 1;

interface ImageCarouselItemProps {
  uri: string;
  onDismiss: () => void;
  alt?: string;
}

export function ImageCarouselItem({uri, onDismiss, alt}: ImageCarouselItemProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const lastTap = useRef(0);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      // Reset if zoomed out past minimum
      if (scale.value < MIN_ZOOM) {
        scale.value = withSpring(MIN_ZOOM);
        savedScale.value = MIN_ZOOM;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture for moving when zoomed or dismissing when not zoomed
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > MIN_ZOOM) {
        // Pan when zoomed - constrain to image bounds
        const maxX = ((SCREEN_WIDTH * scale.value) - SCREEN_WIDTH) / 2;
        const maxY = ((SCREEN_HEIGHT * scale.value) - SCREEN_HEIGHT) / 2;

        const newX = savedTranslateX.value + e.translationX;
        const newY = savedTranslateY.value + e.translationY;

        translateX.value = Math.max(-maxX, Math.min(maxX, newX));
        translateY.value = Math.max(-maxY, Math.min(maxY, newY));
      } else {
        // Vertical pan for dismiss when not zoomed
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value > MIN_ZOOM) {
        // Save position when zoomed
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        // Dismiss if swiped down with sufficient velocity or distance
        const shouldDismiss =
          Math.abs(e.translationY) > 100 ||
          Math.abs(e.velocityY) > 500;

        if (shouldDismiss && e.translationY > 0) {
          runOnJS(onDismiss)();
        } else {
          // Spring back to center
          translateY.value = withSpring(0);
          translateX.value = withSpring(0);
        }
      }
    });

  // Double-tap gesture for zoom toggle
  const tapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > MIN_ZOOM) {
        // Zoom out to 1x
        scale.value = withSpring(MIN_ZOOM);
        savedScale.value = MIN_ZOOM;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  // Combine all gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(tapGesture, pinchGesture),
    panGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: translateX.value},
      {translateY: translateY.value},
      {scale: scale.value},
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <Image
            source={{uri}}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={alt || 'Image'}
          />
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
