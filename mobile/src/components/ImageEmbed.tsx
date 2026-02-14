import React, {useState} from 'react';
import {View, StyleSheet, TouchableOpacity, Text} from 'react-native';
import {Image} from 'expo-image';
import {AppBskyEmbedImages} from '@atproto/api';
import {ImageCarousel, CarouselImage} from './ImageCarousel';
import {colors} from '../constants/theme';

interface ImageEmbedProps {
  images: AppBskyEmbedImages.ViewImage[];
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  blurImages?: boolean;
}

export function ImageEmbed({images, onImagePress, blurImages = false}: ImageEmbedProps) {
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const imageCount = images.length;

  const handleImagePress = (index: number) => {
    if (onImagePress) {
      const imageData = images.map(img => ({
        thumb: img.thumb,
        fullsize: img.fullsize,
        alt: img.alt,
      }));
      onImagePress(imageData, index);
    } else {
      setCurrentImageIndex(index);
      setCarouselVisible(true);
    }
  };

  const carouselImages: CarouselImage[] = images.map(img => ({
    thumb: img.thumb,
    fullsize: img.fullsize,
    alt: img.alt,
  }));

  const getImageStyle = (index: number) => {
    if (imageCount === 1) {
      return styles.singleImage;
    } else if (imageCount === 2) {
      return styles.doubleImage;
    } else if (imageCount === 3) {
      // First image takes 2/3 width, others 1/3
      return index === 0 ? styles.tripleImageLarge : styles.tripleImageSmall;
    } else {
      // 2x2 grid
      return styles.quadImage;
    }
  };

  const getContainerStyle = () => {
    if (imageCount === 1) {
      return styles.singleContainer;
    } else if (imageCount === 2) {
      return styles.doubleContainer;
    } else if (imageCount === 3) {
      return styles.tripleContainer;
    } else {
      return styles.quadContainer;
    }
  };

  return (
    <View style={styles.container}>
      <View style={getContainerStyle()}>
        {images.map((img, idx) => (
          <TouchableOpacity
            key={idx}
            style={getImageStyle(idx)}
            onPress={() => handleImagePress(idx)}
            activeOpacity={0.9}>
            <Image
              source={{uri: img.thumb}}
              style={[styles.image, blurImages && styles.blurredImage]}
              contentFit="cover"
              placeholder={img.aspectRatio ? {blurhash: img.aspectRatio.toString()} : undefined}
              transition={200}
              blurRadius={blurImages ? 20 : 0}
            />
            {img.alt && (
              <View style={styles.altBadge}>
                <Text style={styles.altText}>ALT</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Image Carousel Modal */}
      <ImageCarousel
        images={carouselImages}
        initialIndex={currentImageIndex}
        visible={carouselVisible}
        onClose={() => setCarouselVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
  singleContainer: {
    width: '100%',
  },
  doubleContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  tripleContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  quadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  singleImage: {
    width: '100%',
    height: 300,
    maxHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  doubleImage: {
    flex: 1,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tripleImageLarge: {
    flex: 2,
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tripleImageSmall: {
    flex: 1,
    height: 118,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quadImage: {
    width: '49%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.8,
  },
  altBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  altText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
});
