import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Alert } from 'react-native';


import { createLogger } from '../utils/logger';

const logger = createLogger('Usevideopicker');
export interface VideoAsset {
  uri: string;
  duration: number;
  width: number;
  height: number;
  mimeType: string;
  fileSize?: number;
  thumbnail?: string;
}

const MAX_VIDEO_DURATION = 60; // 60 seconds
const ABSOLUTE_MAX_SIZE = 500 * 1024 * 1024; // 500MB absolute limit

export function useVideoPicker() {
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const generateThumbnail = async (videoUri: string): Promise<string | undefined> => {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0, // Get thumbnail from the beginning
      });
      return uri;
    } catch (error) {
      logger.error('Error generating video thumbnail:', error);
      return undefined;
    }
  };

  const validateVideo = (asset: ImagePicker.ImagePickerAsset): { valid: boolean; error?: string } => {
    // Check duration
    if (asset.duration && asset.duration > MAX_VIDEO_DURATION * 1000) {
      return {
        valid: false,
        error: `Video must be ${MAX_VIDEO_DURATION} seconds or less. Your video is ${Math.round(asset.duration / 1000)} seconds.`,
      };
    }

    // Check file size - allow up to 100MB (compression will reduce), reject over 500MB
    if (asset.fileSize && asset.fileSize > ABSOLUTE_MAX_SIZE) {
      const sizeMB = Math.round(asset.fileSize / (1024 * 1024));
      return {
        valid: false,
        error: `Video is too large (${sizeMB}MB). Maximum size is 500MB.`,
      };
    }

    return { valid: true };
  };

  const pickFromLibrary = async (): Promise<VideoAsset | null> => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to attach videos.'
        );
        return null;
      }

      // Launch video picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];

      // Validate video
      const validation = validateVideo(asset);
      if (!validation.valid) {
        Alert.alert('Invalid Video', validation.error);
        return null;
      }

      // Generate thumbnail
      const thumbnail = await generateThumbnail(asset.uri);

      // Determine MIME type
      let mimeType = 'video/mp4';
      if (asset.uri.toLowerCase().endsWith('.mov')) {
        mimeType = 'video/quicktime';
      } else if (asset.uri.toLowerCase().endsWith('.avi')) {
        mimeType = 'video/x-msvideo';
      }

      const newVideo: VideoAsset = {
        uri: asset.uri,
        duration: asset.duration ? asset.duration / 1000 : 0,
        width: asset.width,
        height: asset.height,
        mimeType,
        fileSize: asset.fileSize,
        thumbnail,
      };

      setSelectedVideo(newVideo);
      return newVideo;
    } catch (error) {
      logger.error('Error picking video from library:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
      return null;
    }
  };

  const recordVideo = async (): Promise<VideoAsset | null> => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your camera to record videos.'
        );
        return null;
      }

      // Launch camera for video recording
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        quality: 1,
        videoMaxDuration: MAX_VIDEO_DURATION,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];

      // Validate video
      const validation = validateVideo(asset);
      if (!validation.valid) {
        Alert.alert('Invalid Video', validation.error);
        return null;
      }

      // Generate thumbnail
      const thumbnail = await generateThumbnail(asset.uri);

      // Determine MIME type
      let mimeType = 'video/mp4';
      if (asset.uri.toLowerCase().endsWith('.mov')) {
        mimeType = 'video/quicktime';
      }

      const newVideo: VideoAsset = {
        uri: asset.uri,
        duration: asset.duration ? asset.duration / 1000 : 0,
        width: asset.width,
        height: asset.height,
        mimeType,
        fileSize: asset.fileSize,
        thumbnail,
      };

      setSelectedVideo(newVideo);
      return newVideo;
    } catch (error) {
      logger.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
      return null;
    }
  };

  const updateVideoUri = (newUri: string, newFileSize?: number) => {
    setSelectedVideo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        uri: newUri,
        mimeType: 'video/mp4', // compressed output is always mp4
        fileSize: newFileSize ?? prev.fileSize,
      };
    });
  };

  const removeVideo = () => {
    setSelectedVideo(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const clearVideo = () => {
    setSelectedVideo(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    pickFromLibrary,
    recordVideo,
    selectedVideo,
    updateVideoUri,
    removeVideo,
    clearVideo,
    isUploading,
    uploadProgress,
    setIsUploading,
    setUploadProgress,
    formatDuration,
    isRecording,
    setIsRecording,
  };
}
