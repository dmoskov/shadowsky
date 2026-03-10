import React, {useMemo} from 'react';
import {View, Text, StyleSheet, useWindowDimensions} from 'react-native';
import {Image} from 'expo-image';
import {useTheme} from '../contexts/ThemeContext';
import {useVideoAutoplay} from '../contexts/VideoAutoplayContext';
import {parseTenorGifDimensions} from '../services/tenor';
import {fontSize} from '../utils/typography';

interface GifEmbedProps {
  uri: string;
  thumb?: string;
  description?: string;
  title?: string;
  isVisible?: boolean;
}

function GifEmbedInner({uri, thumb, description, title, isVisible = false}: GifEmbedProps) {
  const {colors} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const {isAutoplayEnabled} = useVideoAutoplay();

  const shouldAutoplay = isAutoplayEnabled && isVisible;

  const dimensions = useMemo(() => {
    const parsed = parseTenorGifDimensions(uri);
    if (parsed) return parsed;
    return {width: 16, height: 9};
  }, [uri]);

  const containerWidth = screenWidth - 32; // account for post padding
  const aspectRatio = dimensions.width / dimensions.height;
  const calculatedHeight = Math.min(400, Math.max(100, containerWidth / aspectRatio));

  const altText = description?.startsWith('ALT:')
    ? description.slice(4).trim()
    : description || title || '';

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Image
        source={{uri}}
        style={[styles.image, {height: calculatedHeight}]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        autoplay={shouldAutoplay}
        placeholderContentFit="cover"
        placeholder={thumb ? {uri: thumb} : undefined}
        accessibilityLabel={altText}
      />
      <View style={styles.gifBadge}>
        <Text style={styles.gifBadgeText}>GIF</Text>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      position: 'relative',
    },
    image: {
      width: '100%',
    },
    gifBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    gifBadgeText: {
      color: '#fff',
      fontSize: fontSize.caption1,
      fontWeight: '700',
    },
  });
}

export const GifEmbed = React.memo(GifEmbedInner, (prevProps, nextProps) => {
  if (prevProps.uri !== nextProps.uri) return false;
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (prevProps.thumb !== nextProps.thumb) return false;
  return true;
});
