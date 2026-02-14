import React, {useState, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {Video, ResizeMode, AVPlaybackStatus} from 'expo-av';
import {Image} from 'react-native';
import {AppBskyEmbedVideo} from '@atproto/api';


import { createLogger } from '../utils/logger';

const logger = createLogger('Videoembedx');
interface VideoEmbedProps {
  video: AppBskyEmbedVideo.View;
  onPress?: (url: string) => void;
}

export function VideoEmbed({video}: VideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const videoRef = useRef<Video>(null);

  const handlePlayPress = async () => {
    if (!isPlaying) {
      setIsLoading(true);
      setShowThumbnail(false);
      try {
        if (videoRef.current) {
          await videoRef.current.playAsync();
          setIsPlaying(true);
        }
      } catch (error) {
        logger.error('Failed to play video:', error);
        setShowThumbnail(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        if (videoRef.current) {
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        }
      } catch (error) {
        logger.error('Failed to pause video:', error);
      }
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setShowThumbnail(true);
        setIsPlaying(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      {showThumbnail ? (
        <TouchableOpacity
          style={styles.thumbnailContainer}
          onPress={handlePlayPress}
          activeOpacity={0.8}>
          {video.thumbnail && (
            <Image
              source={{uri: video.thumbnail}}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          )}
          <View style={styles.playButtonContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <View style={styles.playButton}>
                <View style={styles.playIcon} />
              </View>
            )}
          </View>
          {video.alt && (
            <View style={styles.altContainer}>
              <Text style={styles.altText}>{video.alt}</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.videoContainer}
          onPress={handlePlayPress}
          activeOpacity={1}>
          <Video
            ref={videoRef}
            source={{uri: video.playlist}}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={true}
            shouldPlay={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />
        </TouchableOpacity>
      )}
    </View>
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
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 240,
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 240,
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
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
