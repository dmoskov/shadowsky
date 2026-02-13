import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Text,
  StatusBar,
  Dimensions,
  Platform,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItemInfo,
} from 'react-native';
import {Image} from 'expo-image';
import {ImageCarouselItem} from './ImageCarouselItem';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export interface CarouselImage {
  thumb: string;
  fullsize: string;
  alt?: string;
}

interface ImageCarouselProps {
  visible: boolean;
  images: CarouselImage[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageCarousel({
  visible,
  images,
  initialIndex,
  onClose,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [altVisible, setAltVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Reset current index when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setAltVisible(false);
    }
  }, [visible, initialIndex]);

  // Preload adjacent images
  useEffect(() => {
    if (visible) {
      const preloadImages = [];

      // Preload current image
      if (images[currentIndex]) {
        preloadImages.push(Image.prefetch(images[currentIndex].fullsize));
      }

      // Preload previous image
      if (currentIndex > 0 && images[currentIndex - 1]) {
        preloadImages.push(Image.prefetch(images[currentIndex - 1].fullsize));
      }

      // Preload next image
      if (currentIndex < images.length - 1 && images[currentIndex + 1]) {
        preloadImages.push(Image.prefetch(images[currentIndex + 1].fullsize));
      }

      Promise.all(preloadImages).catch((error) => {
        console.warn('Failed to preload images:', error);
      });
    }
  }, [visible, currentIndex, images]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);

    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
      // Hide alt text when switching images
      setAltVisible(false);
    }
  };

  const renderItem = ({item}: ListRenderItemInfo<CarouselImage>) => (
    <ImageCarouselItem
      uri={item.fullsize}
      onDismiss={onClose}
      alt={item.alt}
    />
  );

  const getItemLayout = (_: CarouselImage[] | null | undefined, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  const currentImage = images[currentIndex];
  const hasAlt = currentImage?.alt && currentImage.alt.length > 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}>
      <View style={styles.container}>
        {/* Hide status bar on iOS */}
        <StatusBar hidden={Platform.OS === 'ios'} />

        {/* Image carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          windowSize={3}
          maxToRenderPerBatch={3}
          initialNumToRender={1}
          removeClippedSubviews={true}
          bounces={false}
        />

        {/* Top bar with counter and close button */}
        <View style={styles.topBar}>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Page indicator dots */}
        {images.length > 1 && (
          <View style={styles.dotsContainer}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Alt text overlay */}
        {hasAlt && (
          <Pressable
            style={styles.altContainer}
            onPress={() => setAltVisible(!altVisible)}>
            {altVisible ? (
              <View style={styles.altTextBox}>
                <Text style={styles.altText}>{currentImage.alt}</Text>
              </View>
            ) : (
              <View style={styles.altIndicator}>
                <Text style={styles.altIndicatorText}>ALT</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  counter: {
    flex: 1,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  altContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  altIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  altIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  altTextBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 12,
  },
  altText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
});
