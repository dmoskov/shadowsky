import React, {useEffect, useCallback} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {Image} from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {useLightbox, SourceLayout} from '../contexts/LightboxContext';
import {ImageCarousel, CarouselImage} from './ImageCarousel';
import {getOptimizedUrl} from '../utils/image-cdn';
const TRANSITION_DURATION = 300;
const TIMING_CONFIG = {duration: TRANSITION_DURATION, easing: Easing.out(Easing.cubic)};

export function LightboxOverlay() {
  const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = useWindowDimensions();
  const {state, closeLightbox} = useLightbox();
  const {visible, images, index, sourceLayout} = state;

  const animProgress = useSharedValue(0);
  const showCarousel = useSharedValue(false);
  const isAnimating = useSharedValue(false);

  const [carouselReady, setCarouselReady] = React.useState(false);

  const onOpenAnimationEnd = useCallback(() => {
    setCarouselReady(true);
  }, []);

  const onCloseAnimationEnd = useCallback(() => {
    closeLightbox();
    setCarouselReady(false);
  }, [closeLightbox]);

  useEffect(() => {
    if (visible && sourceLayout) {
      // Start open animation
      setCarouselReady(false);
      isAnimating.value = true;
      animProgress.value = 0;
      animProgress.value = withTiming(1, TIMING_CONFIG, (finished) => {
        if (finished) {
          showCarousel.value = true;
          isAnimating.value = false;
          runOnJS(onOpenAnimationEnd)();
        }
      });
    } else if (visible && !sourceLayout) {
      // No source layout, skip animation
      setCarouselReady(true);
    }
  }, [visible, sourceLayout]);

  const handleClose = useCallback(() => {
    if (sourceLayout && !isAnimating.value) {
      // Reverse animation
      setCarouselReady(false);
      showCarousel.value = false;
      isAnimating.value = true;
      animProgress.value = withTiming(0, TIMING_CONFIG, (finished) => {
        if (finished) {
          isAnimating.value = false;
          runOnJS(onCloseAnimationEnd)();
        }
      });
    } else {
      closeLightbox();
      setCarouselReady(false);
    }
  }, [sourceLayout, closeLightbox, onCloseAnimationEnd]);

  // Animated styles for the transition image
  const animatedImageStyle = useAnimatedStyle(() => {
    if (!sourceLayout) return {opacity: 0};

    const src = sourceLayout as SourceLayout;
    const targetWidth = SCREEN_WIDTH;
    const targetHeight = SCREEN_HEIGHT;
    const targetX = 0;
    const targetY = 0;

    return {
      position: 'absolute',
      left: interpolate(animProgress.value, [0, 1], [src.x, targetX]),
      top: interpolate(animProgress.value, [0, 1], [src.y, targetY]),
      width: interpolate(animProgress.value, [0, 1], [src.width, targetWidth]),
      height: interpolate(animProgress.value, [0, 1], [src.height, targetHeight]),
      borderRadius: interpolate(animProgress.value, [0, 1], [12, 0]),
      overflow: 'hidden' as const,
    };
  });

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgba(0, 0, 0, ${interpolate(animProgress.value, [0, 1], [0, 1])})`,
  }));

  if (!visible) {
    return null;
  }

  const currentImage = images[index];
  const carouselImages: CarouselImage[] = images.map(img => ({
    thumb: img.thumb,
    fullsize: img.fullsize,
    alt: img.alt,
  }));

  // If we have a source layout, show the transition animation
  if (sourceLayout && !carouselReady) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        <Animated.View style={animatedBackdropStyle} />
        <Animated.View style={animatedImageStyle}>
          <Image
            source={{uri: getOptimizedUrl(currentImage?.fullsize || currentImage?.thumb || '')}}
            placeholder={{uri: currentImage?.thumb}}
            placeholderContentFit="cover"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        </Animated.View>
      </View>
    );
  }

  // Show the full carousel
  return (
    <ImageCarousel
      images={carouselImages}
      initialIndex={index}
      visible={carouselReady}
      onClose={handleClose}
    />
  );
}
