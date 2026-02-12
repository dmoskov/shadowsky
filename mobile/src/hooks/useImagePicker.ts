import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize?: number;
  altText: string;
}

const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes
const MAX_DIMENSIONS = 2000;

export function useImagePicker() {
  const [selectedImages, setSelectedImages] = useState<ImageAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickFromLibrary = async (): Promise<ImageAsset[]> => {
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

      // Validate and process selected images
      const newImages: ImageAsset[] = [];

      for (const asset of result.assets) {
        // Check file size (estimate from dimensions if not available)
        const estimatedSize = asset.fileSize || (asset.width * asset.height * 4); // Rough estimate

        if (estimatedSize > MAX_FILE_SIZE) {
          Alert.alert(
            'Image Too Large',
            `One or more images exceed the 1MB size limit and will be skipped. Please resize the image and try again.`
          );
          continue;
        }

        // Check if we need to warn about dimensions
        if (asset.width > MAX_DIMENSIONS || asset.height > MAX_DIMENSIONS) {
          Alert.alert(
            'Large Image',
            `Image dimensions exceed ${MAX_DIMENSIONS}x${MAX_DIMENSIONS}px. It may be compressed during upload.`
          );
        }

        // Get MIME type from URI or default to jpeg
        let mimeType = 'image/jpeg';
        if (asset.uri.toLowerCase().endsWith('.png')) {
          mimeType = 'image/png';
        } else if (asset.uri.toLowerCase().endsWith('.webp')) {
          mimeType = 'image/webp';
        }

        newImages.push({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mimeType,
          fileSize: asset.fileSize,
          altText: '',
        });
      }

      // Add new images to the list
      const updatedImages = [...selectedImages, ...newImages].slice(0, MAX_IMAGES);
      setSelectedImages(updatedImages);

      return newImages;
    } catch (error) {
      console.error('Error picking images from library:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
      return [];
    }
  };

  const pickFromCamera = async (): Promise<ImageAsset | null> => {
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

      // Check file size
      const estimatedSize = asset.fileSize || (asset.width * asset.height * 4);

      if (estimatedSize > MAX_FILE_SIZE) {
        Alert.alert(
          'Image Too Large',
          'The photo exceeds the 1MB size limit. Please try taking another photo.'
        );
        return null;
      }

      // Determine MIME type
      let mimeType = 'image/jpeg';
      if (asset.uri.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (asset.uri.toLowerCase().endsWith('.webp')) {
        mimeType = 'image/webp';
      }

      const newImage: ImageAsset = {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType,
        fileSize: asset.fileSize,
        altText: '',
      };

      // Add to the list
      setSelectedImages([...selectedImages, newImage]);

      return newImage;
    } catch (error) {
      console.error('Error taking photo:', error);
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

  return {
    pickFromLibrary,
    pickFromCamera,
    selectedImages,
    removeImage,
    clearImages,
    updateAltText,
    isUploading,
    uploadProgress,
    setIsUploading,
    setUploadProgress,
  };
}
