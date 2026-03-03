import React, {useCallback, useMemo} from 'react';
import {StyleSheet, useWindowDimensions} from 'react-native';
import {Image} from 'expo-image';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDecay,
  runOnJS,
} from 'react-native-reanimated';
import {getOptimizedUrl} from '../utils/image-cdn';
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const RUBBER_BAND_FACTOR = 0.3;
const DISMISS_THRESHOLD = 150;
const DISMISS_VELOCITY = 800;

interface ImageCarouselItemProps {
  uri: string;
  thumb?: string;
  alt?: string;
  onDismiss: () => void;
  onBackgroundOpacityChange?: (opacity: number) => void;
  onSingleTap?: () => void;
  isActive: boolean;
}

export function ImageCarouselItem({
  uri,
  thumb,
  alt,
  onDismiss,
  onBackgroundOpacityChange,
  onSingleTap,
  isActive,
}: ImageCarouselItemProps) {
  const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  React.useEffect(() => {
    if (!isActive) {
      scale.value = withSpring(1, {damping: 20, stiffness: 200});
      savedScale.value = 1;
      translateX.value = withSpring(0, {damping: 20, stiffness: 200});
      translateY.value = withSpring(0, {damping: 20, stiffness: 200});
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [isActive]);

  const getMaxTranslation = useCallback((currentScale: number) => {
    'worklet';
    const maxX = ((SCREEN_WIDTH * currentScale - SCREEN_WIDTH) / 2) / currentScale;
    const maxY = ((SCREEN_HEIGHT * currentScale - SCREEN_HEIGHT) / 2) / currentScale;
    return {maxX, maxY};
  }, [SCREEN_WIDTH, SCREEN_HEIGHT]);

  const rubberBand = useCallback((value: number, limit: number) => {
    'worklet';
    if (Math.abs(value) <= limit) return value;
    const overshoot = Math.abs(value) - limit;
    const damped = limit + overshoot * RUBBER_BAND_FACTOR;
    return value > 0 ? damped : -damped;
  }, []);

  const updateBgOpacity = useCallback((ty: number) => {
    'worklet';
    if (onBackgroundOpacityChange) {
      const opacity = 1 - Math.min(Math.abs(ty) / 300, 1);
      runOnJS(onBackgroundOpacityChange)(opacity);
    }
  }, [onBackgroundOpacityChange]);

  // Pinch gesture: focal-point tracking
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      // Rubber-band at min/max
      if (newScale < MIN_SCALE) {
        scale.value = MIN_SCALE + (newScale - MIN_SCALE) * RUBBER_BAND_FACTOR;
      } else if (newScale > MAX_SCALE) {
        scale.value = MAX_SCALE + (newScale - MAX_SCALE) * RUBBER_BAND_FACTOR;
      } else {
        scale.value = newScale;
      }
    })
    .onEnd(() => {
      savedScale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value));

      if (scale.value < 1.1) {
        scale.value = withSpring(1, {damping: 28, stiffness: 120, mass: 0.8});
        savedScale.value = 1;
        translateX.value = withSpring(0, {damping: 28, stiffness: 120, mass: 0.8});
        translateY.value = withSpring(0, {damping: 28, stiffness: 120, mass: 0.8});
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE, {damping: 28, stiffness: 120, mass: 0.8});
      }
    });

  // Pan gesture: momentum with decay when zoomed, vertical dismiss when not
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        const {maxX, maxY} = getMaxTranslation(scale.value);
        const newX = savedTranslateX.value + e.translationX / scale.value;
        const newY = savedTranslateY.value + e.translationY / scale.value;
        translateX.value = rubberBand(newX, maxX);
        translateY.value = rubberBand(newY, maxY);
      } else {
        translateY.value = e.translationY;
        const scaleDown = 1 - Math.min(Math.abs(e.translationY) / 600, 0.15);
        scale.value = scaleDown;
        updateBgOpacity(e.translationY);
      }
    })
    .onEnd((e) => {
      if (scale.value > 1 || savedScale.value > 1) {
        const {maxX, maxY} = getMaxTranslation(savedScale.value);
        // Decay with momentum, clamped to bounds
        translateX.value = withDecay({
          velocity: e.velocityX / savedScale.value,
          deceleration: 0.997,
          clamp: [-maxX, maxX],
        });
        translateY.value = withDecay({
          velocity: e.velocityY / savedScale.value,
          deceleration: 0.997,
          clamp: [-maxY, maxY],
        });
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        const shouldDismiss =
          Math.abs(e.translationY) > DISMISS_THRESHOLD ||
          Math.abs(e.velocityY) > DISMISS_VELOCITY;
        if (shouldDismiss) {
          // Fly off screen in swipe direction, then dismiss
          const targetY = e.velocityY > 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT;
          translateY.value = withTiming(targetY, {duration: 200}, (finished) => {
            if (finished) {
              runOnJS(onDismiss)();
            }
          });
          scale.value = withTiming(0.8, {duration: 200});
          if (onBackgroundOpacityChange) {
            runOnJS(onBackgroundOpacityChange)(0);
          }
        } else {
          translateY.value = withSpring(0, {damping: 28, stiffness: 120, mass: 0.8});
          scale.value = withSpring(1, {damping: 28, stiffness: 120, mass: 0.8});
          if (onBackgroundOpacityChange) {
            runOnJS(onBackgroundOpacityChange)(1);
          }
        }
      }
    });

  // Single tap: toggle overlay controls
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onSingleTap && scale.value <= 1) {
        runOnJS(onSingleTap)();
      }
    });

  // Double-tap: zoom to 2x at tap point, second double-tap zooms back
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const springConfig = {damping: 28, stiffness: 120, mass: 0.8};
      if (scale.value > 1) {
        scale.value = withSpring(1, springConfig);
        savedScale.value = 1;
        translateX.value = withSpring(0, springConfig);
        translateY.value = withSpring(0, springConfig);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        const newScale = 2;
        const tapX = e.x - SCREEN_WIDTH / 2;
        const tapY = e.y - SCREEN_HEIGHT / 2;

        scale.value = withSpring(newScale, springConfig);
        savedScale.value = newScale;

        const newTranslateX = -tapX / newScale;
        const newTranslateY = -tapY / newScale;
        const {maxX, maxY} = getMaxTranslation(newScale);
        const clampedX = Math.max(-maxX, Math.min(maxX, newTranslateX));
        const clampedY = Math.max(-maxY, Math.min(maxY, newTranslateY));

        translateX.value = withSpring(clampedX, springConfig);
        translateY.value = withSpring(clampedY, springConfig);
        savedTranslateX.value = clampedX;
        savedTranslateY.value = clampedY;
      }
    });

  const tapGesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(tapGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: translateX.value},
      {translateY: translateY.value},
      {scale: scale.value},
    ],
  }));

  const dynamicStyles = useMemo(() => StyleSheet.create({
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
  }), [SCREEN_WIDTH, SCREEN_HEIGHT]);

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[dynamicStyles.container, animatedStyle]}>
        <Image
          source={{uri: getOptimizedUrl(uri)}}
          placeholder={thumb ? {uri: thumb} : undefined}
          placeholderContentFit="contain"
          style={dynamicStyles.image}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={300}
          accessibilityLabel={alt}
        />
      </Animated.View>
    </GestureDetector>
  );
}
