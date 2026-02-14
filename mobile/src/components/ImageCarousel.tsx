import React, {useState, useRef, useCallback} from 'react';
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
} from 'react-native';
import {ImageCarouselItem} from './ImageCarouselItem';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {colors} from '../constants/theme';

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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showAlt, setShowAlt] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Reset to initial index when modal opens
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setShowAlt(false);
    }
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(({viewableItems}: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
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

  const renderItem = useCallback(
    ({item, index}: {item: CarouselImage; index: number}) => (
      <ImageCarouselItem
        uri={item.fullsize}
        alt={item.alt}
        onDismiss={onClose}
        isActive={index === currentIndex}
      />
    ),
    [currentIndex, onClose]
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
      {/* Hide status bar on Android */}
      {Platform.OS === 'android' && <StatusBar hidden />}

      <View style={styles.container}>
        {/* FlatList for horizontal scrolling */}
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

        {/* Counter */}
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.counterContainer}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </Animated.View>

        {/* Close button */}
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.closeButton}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
            accessibilityHint="Double tap to close the image carousel">
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Page indicator dots */}
        {images.length > 1 && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
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
            entering={FadeIn}
            exiting={FadeOut}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.borderDark,
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
