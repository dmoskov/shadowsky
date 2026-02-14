import React, {useRef, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, Text, useWindowDimensions} from 'react-native';
import {Image} from 'expo-image';
import {AppBskyEmbedImages} from '@atproto/api';
import {colors} from '../constants/theme';
import {getOptimizedUrl} from '../utils/image-cdn';
import {useLightbox, LightboxImage} from '../contexts/LightboxContext';

// Instagram-style aspect ratio clamping
const MIN_ASPECT_RATIO = 4 / 5; // portrait (0.8)
const MAX_ASPECT_RATIO = 1.91; // landscape
const MAX_SINGLE_HEIGHT = 600;

function getClampedAspectRatio(
  aspectRatio?: {width: number; height: number},
): number {
  if (!aspectRatio || !aspectRatio.width || !aspectRatio.height) {
    return 1; // default to square
  }
  const ratio = aspectRatio.width / aspectRatio.height;
  return Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, ratio));
}

interface ImageEmbedProps {
  images: AppBskyEmbedImages.ViewImage[];
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  blurImages?: boolean;
}

export function ImageEmbed({images, onImagePress, blurImages = false}: ImageEmbedProps) {
  const {width: windowWidth} = useWindowDimensions();
  const {openLightbox} = useLightbox();
  const imageRefs = useRef<Record<number, View | null>>({});

  // Account for horizontal padding (16px each side)
  const containerWidth = windowWidth - 32;
  const imageCount = images.length;

  const lightboxImages: LightboxImage[] = images.map(img => ({
    thumb: img.thumb,
    fullsize: img.fullsize,
    alt: img.alt,
  }));

  const handleImagePress = useCallback(
    (index: number) => {
      if (onImagePress) {
        const imageData = images.map(img => ({
          thumb: img.thumb,
          fullsize: img.fullsize,
          alt: img.alt,
        }));
        onImagePress(imageData, index);
        return;
      }

      const ref = imageRefs.current[index];
      if (ref) {
        ref.measureInWindow((x, y, width, height) => {
          openLightbox(lightboxImages, index, {x, y, width, height});
        });
      } else {
        openLightbox(lightboxImages, index, null);
      }
    },
    [images, onImagePress, openLightbox, lightboxImages],
  );

  const setImageRef = useCallback((index: number, ref: View | null) => {
    imageRefs.current[index] = ref;
  }, []);

  const getSingleImageHeight = (): number => {
    const ratio = getClampedAspectRatio(images[0]?.aspectRatio);
    return Math.min(containerWidth / ratio, MAX_SINGLE_HEIGHT);
  };

  // Compute adaptive grid heights based on actual aspect ratios
  const getDoubleGridHeight = (): number => {
    const r1 = getClampedAspectRatio(images[0]?.aspectRatio);
    const r2 = getClampedAspectRatio(images[1]?.aspectRatio);
    const avgRatio = (r1 + r2) / 2;
    // Each image gets ~half the width (minus gap)
    const halfWidth = (containerWidth - 4) / 2;
    return Math.min(Math.max(halfWidth / avgRatio, 160), 300);
  };

  const getTripleGridHeight = (): number => {
    const r0 = getClampedAspectRatio(images[0]?.aspectRatio);
    // Large image gets 2/3 width
    const largeWidth = (containerWidth - 4) * 2 / 3;
    return Math.min(Math.max(largeWidth / r0, 200), 320);
  };

  const getQuadGridHeight = (): number => {
    const ratios = images.map(img => getClampedAspectRatio(img?.aspectRatio));
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const halfWidth = (containerWidth - 4) / 2;
    return Math.min(Math.max(halfWidth / avgRatio, 130), 200);
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

  const renderSingleImage = (img: AppBskyEmbedImages.ViewImage, idx: number) => {
    const height = getSingleImageHeight();
    return (
      <TouchableOpacity
        key={idx}
        ref={(ref) => setImageRef(idx, ref)}
        style={[styles.imageWrapper, {width: '100%', height, borderRadius: 12}]}
        onPress={() => handleImagePress(idx)}
        activeOpacity={0.9}>
        <Image
          source={{uri: getOptimizedUrl(img.thumb)}}
          style={[styles.image, blurImages && styles.blurredImage]}
          contentFit="cover"
          placeholder={{uri: img.thumb}}
          placeholderContentFit="cover"
          transition={300}
          blurRadius={blurImages ? 20 : 0}
        />
        {img.alt && (
          <View style={styles.altBadge}>
            <Text style={styles.altText}>ALT</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGridImage = (
    img: AppBskyEmbedImages.ViewImage,
    idx: number,
    style: object,
  ) => (
    <TouchableOpacity
      key={idx}
      ref={(ref) => setImageRef(idx, ref)}
      style={[styles.imageWrapper, style]}
      onPress={() => handleImagePress(idx)}
      activeOpacity={0.9}>
      <Image
        source={{uri: getOptimizedUrl(img.thumb)}}
        style={[styles.image, blurImages && styles.blurredImage]}
        contentFit="cover"
        placeholder={{uri: img.thumb}}
        placeholderContentFit="cover"
        transition={300}
        blurRadius={blurImages ? 20 : 0}
      />
      {img.alt && (
        <View style={styles.altBadge}>
          <Text style={styles.altText}>ALT</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const getGridStyle = (index: number): object => {
    if (imageCount === 2) {
      const h = getDoubleGridHeight();
      return {flex: 1, height: h, borderRadius: 12};
    } else if (imageCount === 3) {
      const h = getTripleGridHeight();
      if (index === 0) {
        return {flex: 2, height: h, borderRadius: 12};
      }
      // Small images share the same total height, split by gap
      return {flex: 1, height: (h - 4) / 2, borderRadius: 12};
    } else {
      const h = getQuadGridHeight();
      return {width: '49%' as any, height: h, borderRadius: 12};
    }
  };

  const renderGrid = () => {
    if (imageCount === 1) {
      return renderSingleImage(images[0], 0);
    }
    if (imageCount === 3) {
      const h = getTripleGridHeight();
      const smallH = (h - 4) / 2;
      return (
        <>
          {renderGridImage(images[0], 0, {flex: 2, height: h, borderRadius: 12})}
          <View style={{flex: 1, gap: 4}}>
            {renderGridImage(images[1], 1, {flex: 1, height: smallH, borderRadius: 12})}
            {renderGridImage(images[2], 2, {flex: 1, height: smallH, borderRadius: 12})}
          </View>
        </>
      );
    }
    return images.map((img, idx) => renderGridImage(img, idx, getGridStyle(idx)));
  };

  return (
    <View style={styles.container}>
      <View style={getContainerStyle()}>
        {renderGrid()}
      </View>
      {imageCount > 1 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>1/{imageCount}</Text>
        </View>
      )}
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
  imageWrapper: {
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
  countBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
});
