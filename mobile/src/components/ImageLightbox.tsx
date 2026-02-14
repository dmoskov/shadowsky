import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  Text,
  Modal,
  Platform,
} from 'react-native';
import {Image} from 'expo-image';
import {colors} from '../constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface ImageData {
  thumb: string;
  fullsize: string;
  alt?: string;
}

interface ImageLightboxProps {
  visible: boolean;
  images: ImageData[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageLightbox({
  visible,
  images,
  initialIndex,
  onClose,
}: ImageLightboxProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const imageIndex = useSharedValue(initialIndex);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const opacity = useSharedValue(0);
  const dismissProgress = useSharedValue(0);

  // Horizontal scroll position for gallery
  const galleryTranslateX = useSharedValue(-initialIndex * SCREEN_WIDTH);

  useEffect(() => {
    if (visible) {
      // Reset values when opening
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      imageIndex.value = initialIndex;
      setCurrentIndex(initialIndex);
      galleryTranslateX.value = -initialIndex * SCREEN_WIDTH;
      opacity.value = withTiming(1, {duration: 200});

      // Hide status bar
      StatusBar.setHidden(true, 'fade');
    } else {
      // Show status bar when closing
      StatusBar.setHidden(false, 'fade');
    }
  }, [visible, initialIndex]);

  const handleClose = () => {
    'worklet';
    opacity.value = withTiming(0, {duration: 200}, () => {
      runOnJS(onClose)();
    });
  };

  const updateCurrentIndex = (newIndex: number) => {
    'worklet';
    runOnJS(setCurrentIndex)(newIndex);
  };

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate(event => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      // Snap back to 1x if close to it
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture for moving when zoomed
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      if (scale.value > 1) {
        // Allow panning when zoomed in
        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;

        const newTranslateX = savedTranslateX.value + event.translationX;
        const newTranslateY = savedTranslateY.value + event.translationY;

        translateX.value = Math.min(
          Math.max(newTranslateX, -maxTranslateX),
          maxTranslateX
        );
        translateY.value = Math.min(
          Math.max(newTranslateY, -maxTranslateY),
          maxTranslateY
        );
      } else {
        // Swipe down to dismiss when not zoomed
        if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
          translateY.value = event.translationY;
          dismissProgress.value = Math.abs(event.translationY) / 200;
        } else if (images.length > 1) {
          // Horizontal swipe for gallery navigation
          galleryTranslateX.value =
            -imageIndex.value * SCREEN_WIDTH + event.translationX;
        }
      }
    })
    .onEnd(event => {
      if (scale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        // Check if should dismiss
        if (Math.abs(event.translationY) > 100 && scale.value === 1) {
          handleClose();
        } else if (
          images.length > 1 &&
          Math.abs(event.translationX) > Math.abs(event.translationY)
        ) {
          // Gallery navigation
          const velocity = event.velocityX;
          const shouldSwipe = Math.abs(velocity) > 500 || Math.abs(event.translationX) > SCREEN_WIDTH / 3;

          if (shouldSwipe) {
            if (velocity < 0 && imageIndex.value < images.length - 1) {
              // Swipe left - next image
              imageIndex.value = imageIndex.value + 1;
              updateCurrentIndex(imageIndex.value);
            } else if (velocity > 0 && imageIndex.value > 0) {
              // Swipe right - previous image
              imageIndex.value = imageIndex.value - 1;
              updateCurrentIndex(imageIndex.value);
            }
          }

          // Animate to the correct position
          galleryTranslateX.value = withSpring(-imageIndex.value * SCREEN_WIDTH, {
            damping: 20,
            stiffness: 90,
          });

          // Reset zoom when changing images
          scale.value = withSpring(1);
          savedScale.value = 1;
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
        } else {
          // Snap back
          translateY.value = withSpring(0);
          dismissProgress.value = withSpring(0);
        }
      }
    });

  // Double tap to zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(event => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x at tap point
        const targetScale = 2;

        // Calculate the focal point offset
        const focalX = event.x - SCREEN_WIDTH / 2;
        const focalY = event.y - SCREEN_HEIGHT / 2;

        scale.value = withSpring(targetScale);
        savedScale.value = targetScale;

        // Center on tap point
        translateX.value = withSpring(-focalX * (targetScale - 1) / targetScale);
        translateY.value = withSpring(-focalY * (targetScale - 1) / targetScale);
        savedTranslateX.value = -focalX * (targetScale - 1) / targetScale;
        savedTranslateY.value = -focalY * (targetScale - 1) / targetScale;
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, Gesture.Simultaneous(pinchGesture, panGesture))
  );

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {scale: scale.value},
      ],
    };
  });

  const animatedGalleryStyle = useAnimatedStyle(() => {
    return {
      transform: [{translateX: galleryTranslateX.value}],
    };
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    const bgOpacity = interpolate(
      dismissProgress.value,
      [0, 1],
      [1, 0],
      Extrapolate.CLAMP
    );
    return {
      opacity: opacity.value,
      backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        dismissProgress.value,
        [0, 1],
        [1, 0.5],
        Extrapolate.CLAMP
      ),
    };
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.rootView}>
        <Animated.View style={[styles.container, animatedContainerStyle]}>
          <Animated.View style={[styles.gallery, animatedGalleryStyle]}>
            {images.map((image, index) => (
              <GestureDetector key={index} gesture={composedGesture}>
                <Animated.View style={styles.imageSlide}>
                  <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
                    <Image
                      source={{uri: image.fullsize}}
                      style={styles.image}
                      contentFit="contain"
                    />
                  </Animated.View>
                </Animated.View>
              </GestureDetector>
            ))}
          </Animated.View>

          <Animated.View style={[styles.overlayContent, animatedContentStyle]}>
            {/* Image counter for multi-image posts */}
            {images.length > 1 && (
              <View style={styles.counterContainer}>
                <Text style={styles.counterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            )}

            {/* Alt text at bottom */}
            {images[currentIndex]?.alt && (
              <View style={styles.altContainer}>
                <Text style={styles.altText}>
                  {images[currentIndex].alt}
                </Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.borderDark,
  },
  gallery: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * 10, // Support up to 10 images
    height: SCREEN_HEIGHT,
  },
  imageSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlayContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  counterContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  altContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 16,
    borderRadius: 12,
  },
  altText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
