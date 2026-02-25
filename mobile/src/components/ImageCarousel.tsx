import React, {useState, useRef, useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  StatusBar,
  TouchableOpacity,
  Text,
  FlatList,
  Dimensions,
  Platform,
  Alert,
  Share,
} from 'react-native';
import {Image} from 'expo-image';
import { DownloadIcon } from './icons';
import {ImageCarouselItem} from './ImageCarouselItem';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import { useTheme } from "../contexts/ThemeContext";
import {getOptimizedUrl} from '../utils/image-cdn';
import {saveImageToGallery} from '../utils/save-image';
import {triggerHaptic} from '../utils/haptics';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export interface CarouselImage {
  thumb: string;
  fullsize: string;
  alt?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

export function ImageCarousel({
  images,
  initialIndex,
  visible,
  onClose,
}: ImageCarouselProps) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showAlt, setShowAlt] = useState(false);
  const [bgOpacity, setBgOpacity] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setShowAlt(false);
      setBgOpacity(1);
      setControlsVisible(true);

      // Prefetch all fullsize images when lightbox opens
      const urls = images.map(i => getOptimizedUrl(i.fullsize));
      Image.prefetch(urls);
    }
  }, [visible, initialIndex, images]);

  const prevIndexRef = useRef(initialIndex);
  const onViewableItemsChanged = useRef(({viewableItems}: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index ?? 0;
      if (newIndex !== prevIndexRef.current) {
        prevIndexRef.current = newIndex;
        triggerHaptic('selection');
      }
      setCurrentIndex(newIndex);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const handleBgOpacityChange = useCallback((opacity: number) => {
    setBgOpacity(opacity);
  }, []);

  const handleToggleControls = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const image = images[currentIndex];
    if (!image) return;

    setIsSaving(true);
    try {
      await saveImageToGallery(image.fullsize);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save image');
    } finally {
      setIsSaving(false);
    }
  }, [currentIndex, images, isSaving]);

  const handleShare = useCallback(async () => {
    const image = images[currentIndex];
    if (!image) return;
    try {
      await Share.share({
        url: image.fullsize,
        message: Platform.OS === 'android' ? image.fullsize : undefined,
      });
    } catch {
      // User cancelled
    }
  }, [currentIndex, images]);

  const renderItem = useCallback(
    ({item, index}: {item: CarouselImage; index: number}) => (
      <ImageCarouselItem
        uri={item.fullsize}
        thumb={item.thumb}
        alt={item.alt}
        onDismiss={onClose}
        onBackgroundOpacityChange={handleBgOpacityChange}
        onSingleTap={handleToggleControls}
        isActive={index === currentIndex}
      />
    ),
    [currentIndex, onClose, handleBgOpacityChange, handleToggleControls]
  );

  const keyExtractor = useCallback(
    (_item: CarouselImage, index: number) => `image-${index}`,
    []
  );

  const currentImage = images[currentIndex];
  const hasAlt = currentImage?.alt && currentImage.alt.length > 0;

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}>
      {Platform.OS === 'android' && <StatusBar hidden />}

      <View style={[styles.container, {backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`}]}>
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
          removeClippedSubviews={true}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          accessible={true}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Image ${currentIndex + 1} of ${images.length}${currentImage?.alt ? `. ${currentImage.alt}` : ''}`}
          accessibilityHint="Swipe left or right to navigate between images"
        />

        {/* Overlay controls - tap to toggle */}
        {controlsVisible && (
          <>
            {/* Counter */}
            {images.length > 1 && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={styles.counterContainer}>
                <Text style={styles.counterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </Animated.View>
            )}

            {/* Close button */}
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={styles.closeButton}>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Close image viewer"
                accessibilityHint="Double tap to close the image carousel">
                <Text style={styles.closeButtonText}>{'\u2715'}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Bottom controls row */}
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={styles.bottomControls}>
              {/* Save button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Save image to gallery"
                style={[styles.bottomButton, {opacity: isSaving ? 0.5 : 1}]}>
                <DownloadIcon size={20} color={colors.text} />
              </TouchableOpacity>

              {/* Share button */}
              <TouchableOpacity
                onPress={handleShare}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Share image"
                style={styles.bottomButton}>
                <Text style={styles.shareIcon}>{'\u{2B06}\u{FE0E}'}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Page indicator dots */}
            {images.length > 1 && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={styles.dotsContainer}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </Animated.View>
            )}

            {/* Alt text overlay */}
            {hasAlt && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={styles.altContainer}>
                <TouchableOpacity
                  onPress={() => setShowAlt(!showAlt)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={showAlt ? `Alt text: ${currentImage.alt}` : 'Show image description'}
                  accessibilityHint={showAlt ? 'Double tap to hide image description' : 'Double tap to show image description'}>
                  {showAlt ? (
                    <View style={styles.altTextExpanded}>
                      <Text style={styles.altText}>{currentImage.alt}</Text>
                    </View>
                  ) : (
                    <View style={styles.altBadge}>
                      <Text style={styles.altBadgeText}>ALT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    counterContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 20,
      left: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    counterText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    closeButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 20,
      right: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '400',
    },
    bottomControls: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 50 : 20,
      right: 16,
      flexDirection: 'row',
      gap: 12,
    },
    bottomButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    shareIcon: {
      color: colors.text,
      fontSize: 16,
    },
    dotsContainer: {
      position: 'absolute',
      bottom: 40,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
      backgroundColor: colors.text,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    altContainer: {
      position: 'absolute',
      bottom: 70,
      left: 16,
      right: 16,
    },
    altBadge: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start',
    },
    altBadgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    altTextExpanded: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      borderRadius: 12,
    },
    altText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
