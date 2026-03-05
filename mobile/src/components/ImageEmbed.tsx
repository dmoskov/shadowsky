import React, {useRef, useCallback, useMemo} from 'react';
import {View, StyleSheet, TouchableOpacity, Text, useWindowDimensions} from 'react-native';
import {Image} from 'expo-image';
import {AppBskyEmbedImages} from '@atproto/api';
import { useTheme } from "../contexts/ThemeContext";
import {getOptimizedUrl} from '../utils/image-cdn';
import {useLightbox, LightboxImage, LightboxPostMeta} from '../contexts/LightboxContext';
import {fontSize} from '../utils/typography';

// Aspect ratio clamping constants
const MIN_ASPECT_RATIO = 4 / 5; // portrait (0.8)
const MAX_ASPECT_RATIO = 1.91; // landscape – used only for grid layouts
const MAX_SINGLE_HEIGHT = 600;

// For grid layouts: clamp both min and max to keep cells consistent
function getClampedAspectRatio(
  aspectRatio?: {width: number; height: number},
): number {
  if (!aspectRatio || !aspectRatio.width || !aspectRatio.height) {
    return 1; // default to square
  }
  const ratio = aspectRatio.width / aspectRatio.height;
  return Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, ratio));
}

// For single images: only clamp the minimum (portrait) side.
// Wide images keep their natural aspect ratio so they aren't stretched.
function getSingleAspectRatio(
  aspectRatio?: {width: number; height: number},
): number {
  if (!aspectRatio || !aspectRatio.width || !aspectRatio.height) {
    return 1;
  }
  const ratio = aspectRatio.width / aspectRatio.height;
  return Math.max(MIN_ASPECT_RATIO, ratio);
}

interface ImageEmbedProps {
  images: AppBskyEmbedImages.ViewImage[];
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  blurImages?: boolean;
  postUri?: string;
  postAuthorDid?: string;
}

export function ImageEmbed({images, onImagePress, blurImages = false, postUri, postAuthorDid}: ImageEmbedProps) {
  const { colors } = useTheme();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const {openLightbox} = useLightbox();
  const imageRefs = useRef<Record<number, View | null>>({});
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Account for horizontal padding (16px each side)
  const containerWidth = windowWidth - 32;
  const imageCount = images.length;

  const lightboxImages: LightboxImage[] = images.map(img => ({
    thumb: img.thumb,
    fullsize: img.fullsize,
    alt: img.alt,
  }));

  const postMeta: LightboxPostMeta | null = postUri && postAuthorDid
    ? {postUri, postAuthorDid}
    : null;

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
          openLightbox(lightboxImages, index, {x, y, width, height}, postMeta);
        });
      } else {
        openLightbox(lightboxImages, index, null, postMeta);
      }
    },
    [images, onImagePress, openLightbox, lightboxImages, postMeta],
  );

  const setImageRef = useCallback((index: number, ref: View | null) => {
    imageRefs.current[index] = ref;
  }, []);

  // Scale minimum image height with screen height (cap at 200 for large screens,
  // ~150 on iPhone SE's 667pt screen) to avoid panoramas dominating small displays
  const minSingleHeight = Math.min(200, Math.round(windowHeight * 0.22));

  const getSingleImageHeight = (): number => {
    const ratio = getSingleAspectRatio(images[0]?.aspectRatio);
    const height = containerWidth / ratio;
    return Math.max(Math.min(height, MAX_SINGLE_HEIGHT), minSingleHeight);
  };

  // Scale grid height bounds for small screens (iPhone SE = 667pt)
  const isSmallScreen = windowHeight < 700;

  // Compute adaptive grid heights based on actual aspect ratios
  const getDoubleGridHeight = (): number => {
    const r1 = getClampedAspectRatio(images[0]?.aspectRatio);
    const r2 = getClampedAspectRatio(images[1]?.aspectRatio);
    const avgRatio = (r1 + r2) / 2;
    // Each image gets ~half the width (minus gap)
    const halfWidth = (containerWidth - 4) / 2;
    const minH = isSmallScreen ? 130 : 160;
    const maxH = isSmallScreen ? 240 : 300;
    return Math.min(Math.max(halfWidth / avgRatio, minH), maxH);
  };

  const getTripleGridHeight = (): number => {
    const r0 = getClampedAspectRatio(images[0]?.aspectRatio);
    // Large image gets 2/3 width
    const largeWidth = (containerWidth - 4) * 2 / 3;
    const minH = isSmallScreen ? 160 : 200;
    const maxH = isSmallScreen ? 260 : 320;
    return Math.min(Math.max(largeWidth / r0, minH), maxH);
  };

  const getQuadGridHeight = (): number => {
    const ratios = images.map(img => getClampedAspectRatio(img?.aspectRatio));
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const halfWidth = (containerWidth - 4) / 2;
    const minH = isSmallScreen ? 100 : 130;
    const maxH = isSmallScreen ? 160 : 200;
    return Math.min(Math.max(halfWidth / avgRatio, minH), maxH);
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
        activeOpacity={0.9}
        accessibilityRole="image"
        accessibilityLabel={img.alt || 'Image'}>
        <Image
          source={{uri: getOptimizedUrl(img.thumb)}}
          style={[styles.image, blurImages && styles.blurredImage]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={img.thumb}
          transition={200}
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
      activeOpacity={0.9}
      accessibilityRole="image"
      accessibilityLabel={img.alt || `Image ${idx + 1} of ${imageCount}`}>
      <Image
        source={{uri: getOptimizedUrl(img.thumb)}}
        style={[styles.image, blurImages && styles.blurredImage]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={img.thumb}
        transition={200}
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

function createStyles(colors: any) {
  return StyleSheet.create({
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
      fontSize: fontSize.caption2,
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
      fontSize: fontSize.caption2,
      fontWeight: '600',
    },
  });
}
