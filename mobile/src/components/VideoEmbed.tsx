import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Image} from 'react-native';
import {AppBskyEmbedVideo} from '@atproto/api';
import {openLink} from '../utils/browser';

interface VideoEmbedProps {
  video: AppBskyEmbedVideo.View;
  onPress?: (url: string) => void;
}

export function VideoEmbed({video, onPress}: VideoEmbedProps) {
  const handlePress = async () => {
    // Get the video URL from the playlist
    const videoUrl = video.playlist;

    if (onPress) {
      onPress(videoUrl);
    } else if (videoUrl) {
      try {
        await openLink(videoUrl);
      } catch (error) {
        console.error('Failed to open video URL:', error);
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}>
      {video.thumbnail && (
        <Image
          source={{uri: video.thumbnail}}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}
      <View style={styles.playButtonContainer}>
        <View style={styles.playButton}>
          <View style={styles.playIcon} />
        </View>
      </View>
      {video.alt && (
        <View style={styles.altContainer}>
          <Text style={styles.altText}>{video.alt}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 240,
  },
  playButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderLeftWidth: 20,
    borderLeftColor: '#ffffff',
    borderTopWidth: 12,
    borderTopColor: 'transparent',
    borderBottomWidth: 12,
    borderBottomColor: 'transparent',
  },
  altContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
  },
  altText: {
    color: '#ffffff',
    fontSize: 12,
  },
});
