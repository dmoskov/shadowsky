import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { compressImage } from '../../modules/image-compressor';

import { createLogger } from '../utils/logger';

const logger = createLogger('Useimagepicker');
export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize?: number;
  altText: string;
}

const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 1_000_000; // 1MB in bytes
const MAX_DIMENSIONS = 2000;
const COMPRESS_THRESHOLD = 800_000; // Auto-compress if over 800KB

/**
 * Auto-compress an image if it exceeds size/dimension limits.
 * Uses native ImageCompressor module on iOS for hardware-accelerated processing.
 * Falls back to returning the original asset if native module is unavailable.
 */
async function autoCompressAsset(
  asset: ImagePicker.ImagePickerAsset,
  mimeType: string,
): Promise<ImageAsset> {
  const estimatedSize = asset.fileSize || (asset.width * asset.height * 4);
  const needsCompression =
    estimatedSize > COMPRESS_THRESHOLD ||
    asset.width > MAX_DIMENSIONS ||
    asset.height > MAX_DIMENSIONS;

  if (!needsCompression) {
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType,
      fileSize: asset.fileSize,
      altText: '',
    };
  }

  try {
    const isPng = mimeType === 'image/png';
    const result = await compressImage(asset.uri, {
      quality: 0.85,
      maxFileSize: MAX_FILE_SIZE,
      maxDimension: MAX_DIMENSIONS,
      format: isPng ? 'png' : 'jpeg',
    });

    if (result) {
      logger.log(
        `Auto-compressed: ${Math.round((asset.fileSize || 0) / 1024)}KB -> ${Math.round(result.compressedSize / 1024)}KB`,
      );
      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        fileSize: result.compressedSize,
        altText: '',
      };
    }
  } catch (error) {
    logger.error('Auto-compression failed, using original:', error);
  }

  // Fallback: return original
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType,
    fileSize: asset.fileSize,
    altText: '',
  };
}

export function useImagePicker() {
  const [selectedImages, setSelectedImages] = useState<ImageAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickFromLibrary = async (skipEditor = false): Promise<ImageAsset[]> => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to attach images.'
        );
        return [];
      }

      // Calculate how many more images can be selected
      const remaining = MAX_IMAGES - selectedImages.length;
      if (remaining <= 0) {
        Alert.alert('Limit Reached', `You can only attach up to ${MAX_IMAGES} images.`);
        return [];
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
        exif: false,
      });

      if (result.canceled) {
        return [];
      }

      // Process selected images with auto-compression
      const newImages: ImageAsset[] = [];

      for (const asset of result.assets) {
        // Get MIME type from URI or default to jpeg
        let mimeType = 'image/jpeg';
        if (asset.uri.toLowerCase().endsWith('.png')) {
          mimeType = 'image/png';
        } else if (asset.uri.toLowerCase().endsWith('.webp')) {
          mimeType = 'image/webp';
        }

        // Auto-compress if needed (replaces the old size-check-and-reject flow)
        const compressed = await autoCompressAsset(asset, mimeType);
        newImages.push(compressed);
      }

      // Only add to selected images if skipping editor
      if (skipEditor) {
        const updatedImages = [...selectedImages, ...newImages].slice(0, MAX_IMAGES);
        setSelectedImages(updatedImages);
      }

      return newImages;
    } catch (error) {
      logger.error('Error picking images from library:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
      return [];
    }
  };

  const pickFromCamera = async (skipEditor = false): Promise<ImageAsset | null> => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your camera to take photos.'
        );
        return null;
      }

      // Check if we can add more images
      if (selectedImages.length >= MAX_IMAGES) {
        Alert.alert('Limit Reached', `You can only attach up to ${MAX_IMAGES} images.`);
        return null;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];

      // Determine MIME type
      let mimeType = 'image/jpeg';
      if (asset.uri.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (asset.uri.toLowerCase().endsWith('.webp')) {
        mimeType = 'image/webp';
      }

      // Auto-compress if needed
      const newImage = await autoCompressAsset(asset, mimeType);

      // Only add to selected images if skipping editor
      if (skipEditor) {
        setSelectedImages([...selectedImages, newImage]);
      }

      return newImage;
    } catch (error) {
      logger.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      return null;
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setSelectedImages([]);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const updateAltText = (index: number, altText: string) => {
    setSelectedImages(selectedImages.map((img, i) =>
      i === index ? { ...img, altText } : img
    ));
  };

  const addImages = (images: ImageAsset[]) => {
    const updatedImages = [...selectedImages, ...images].slice(0, MAX_IMAGES);
    setSelectedImages(updatedImages);
  };

  return {
    pickFromLibrary,
    pickFromCamera,
    selectedImages,
    removeImage,
    clearImages,
    updateAltText,
    addImages,
    isUploading,
    uploadProgress,
    setIsUploading,
    setUploadProgress,
  };
}
