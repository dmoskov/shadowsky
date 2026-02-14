import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Image} from 'expo-image';
import {AppBskyEmbedExternal} from '@atproto/api';
import {openLink} from '../utils/browser';
import {colors} from '../constants/theme';


import { createLogger } from '../utils/logger';

const logger = createLogger('Externallinkembedx');
interface ExternalLinkEmbedProps {
  external: AppBskyEmbedExternal.ViewExternal;
  onPress?: (url: string) => void;
}

export function ExternalLinkEmbed({external, onPress}: ExternalLinkEmbedProps) {
  const handlePress = async () => {
    if (onPress) {
      onPress(external.uri);
    } else {
      try {
        await openLink(external.uri);
      } catch (error) {
        logger.error('Failed to open URL:', error);
      }
    }
  };

  // Extract domain from URL
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}>
      {external.thumb && (
        <Image
          source={{uri: external.thumb}}
          style={styles.thumbnail}
          contentFit="cover"
        />
      )}
      <View style={styles.textContainer}>
        <Text style={styles.domain} numberOfLines={1}>
          {getDomain(external.uri)}
        </Text>
        {external.title && (
          <Text style={styles.title} numberOfLines={2}>
            {external.title}
          </Text>
        )}
        {external.description && (
          <Text style={styles.description} numberOfLines={2}>
            {external.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    backgroundColor: 'colors.background',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surfaceElevated,
  },
  textContainer: {
    padding: 12,
  },
  domain: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
