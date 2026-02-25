import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {Image} from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from "../contexts/ThemeContext";
import { ImageAsset } from '../hooks/useImagePicker';


import { createLogger } from '../utils/logger';

const logger = createLogger('Imageeditorx');
// Aspect ratio presets
const ASPECT_RATIOS = {
  free: { name: 'Free', ratio: null },
  '1:1': { name: 'Square', ratio: 1 },
  '4:3': { name: '4:3', ratio: 4 / 3 },
  '3:4': { name: '3:4', ratio: 3 / 4 },
  '16:9': { name: '16:9', ratio: 16 / 9 },
  '9:16': { name: '9:16', ratio: 9 / 16 },
} as const;

type AspectRatioKey = keyof typeof ASPECT_RATIOS;

interface CropArea {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface ImageEdits {
  rotation: number; // degrees: 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  cropArea: CropArea | null;
}

interface EditedImage {
  originalAsset: ImageAsset;
  editedAsset: ImageAsset;
  edits: ImageEdits;
}

interface ImageEditorProps {
  images: ImageAsset[];
  onSave: (editedImages: EditedImage[]) => void;
  onCancel: () => void;
  visible: boolean;
}

const DEFAULT_EDITS: ImageEdits = {
  rotation: 0,
  flipH: false,
  flipV: false,
  cropArea: null,
};

function ImageEditorInner({ images, onSave, onCancel, visible }: ImageEditorProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedImages, setEditedImages] = useState<Map<number, EditedImage>>(new Map());
  const [edits, setEdits] = useState<ImageEdits>({ ...DEFAULT_EDITS });
  const [isCropping, setIsCropping] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioKey>('free');
  const [isSaving, setIsSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const currentImage = images[currentIndex];

  // Load existing edits when switching images
  useEffect(() => {
    const existing = editedImages.get(currentIndex);
    if (existing) {
      setEdits(existing.edits);
      setPreviewUri(existing.editedAsset.uri);
    } else {
      setEdits({ ...DEFAULT_EDITS });
      setPreviewUri(currentImage?.uri || null);
    }
    setIsCropping(false);
  }, [currentIndex, editedImages, currentImage]);

  // Reset preview when edits change
  useEffect(() => {
    if (!currentImage) return;

    // If no edits, use original
    const hasEdits = edits.rotation !== 0 || edits.flipH || edits.flipV || edits.cropArea !== null;
    if (!hasEdits) {
      setPreviewUri(currentImage.uri);
    }
  }, [edits, currentImage]);

  // Rotate image
  const rotate = (direction: 'cw' | 'ccw') => {
    setEdits((prev) => ({
      ...prev,
      rotation: direction === 'cw'
        ? ((prev.rotation + 90) % 360)
        : ((prev.rotation - 90 + 360) % 360),
    }));
  };

  // Flip image
  const flip = (direction: 'h' | 'v') => {
    setEdits((prev) => ({
      ...prev,
      flipH: direction === 'h' ? !prev.flipH : prev.flipH,
      flipV: direction === 'v' ? !prev.flipV : prev.flipV,
    }));
  };

  // Reset edits
  const resetEdits = () => {
    setEdits({ ...DEFAULT_EDITS });
    setIsCropping(false);
    setPreviewUri(currentImage?.uri || null);
  };

  // Initialize crop area based on aspect ratio
  const initCrop = useCallback(() => {
    if (!currentImage) return;

    const imageWidth = currentImage.width;
    const imageHeight = currentImage.height;
    const aspectRatio = ASPECT_RATIOS[selectedAspectRatio].ratio;

    let cropArea: CropArea;

    if (!aspectRatio) {
      // Free crop - use full image
      cropArea = {
        originX: 0,
        originY: 0,
        width: imageWidth,
        height: imageHeight,
      };
    } else {
      // Apply aspect ratio
      const imgAspect = imageWidth / imageHeight;
      if (imgAspect > aspectRatio) {
        // Image is wider - constrain by height
        const newWidth = imageHeight * aspectRatio;
        cropArea = {
          originX: (imageWidth - newWidth) / 2,
          originY: 0,
          width: newWidth,
          height: imageHeight,
        };
      } else {
        // Image is taller - constrain by width
        const newHeight = imageWidth / aspectRatio;
        cropArea = {
          originX: 0,
          originY: (imageHeight - newHeight) / 2,
          width: imageWidth,
          height: newHeight,
        };
      }
    }

    setEdits((prev) => ({ ...prev, cropArea }));
    setIsCropping(true);
  }, [currentImage, selectedAspectRatio]);

  // Apply edits using expo-image-manipulator
  const applyEdits = async (asset: ImageAsset, editsToApply: ImageEdits): Promise<ImageAsset> => {
    try {
      const actions: ImageManipulator.Action[] = [];

      // Apply crop first if set
      if (editsToApply.cropArea) {
        actions.push({
          crop: {
            originX: Math.round(editsToApply.cropArea.originX),
            originY: Math.round(editsToApply.cropArea.originY),
            width: Math.round(editsToApply.cropArea.width),
            height: Math.round(editsToApply.cropArea.height),
          },
        });
      }

      // Apply rotation
      if (editsToApply.rotation !== 0) {
        actions.push({ rotate: editsToApply.rotation });
      }

      // Apply flips
      if (editsToApply.flipH) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }
      if (editsToApply.flipV) {
        actions.push({ flip: ImageManipulator.FlipType.Vertical });
      }

      // If no edits, return original
      if (actions.length === 0) {
        return asset;
      }

      // Apply manipulations
      const result = await ImageManipulator.manipulateAsync(
        asset.uri,
        actions,
        {
          compress: 0.9,
          format: asset.mimeType === 'image/png'
            ? ImageManipulator.SaveFormat.PNG
            : ImageManipulator.SaveFormat.JPEG,
        }
      );

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: asset.mimeType,
        fileSize: undefined, // Will be calculated on upload
        altText: asset.altText,
      };
    } catch (error) {
      logger.error('Error applying edits:', error);
      throw error;
    }
  };

  // Save current image edits
  const saveCurrentImage = async () => {
    try {
      const hasEdits = edits.rotation !== 0 || edits.flipH || edits.flipV || edits.cropArea !== null;

      let editedAsset = currentImage;
      if (hasEdits) {
        editedAsset = await applyEdits(currentImage, edits);
      }

      const edited: EditedImage = {
        originalAsset: currentImage,
        editedAsset,
        edits: { ...edits },
      };

      setEditedImages((prev) => {
        const newMap = new Map(prev);
        newMap.set(currentIndex, edited);
        return newMap;
      });

      setPreviewUri(editedAsset.uri);

      return edited;
    } catch (error) {
      logger.error('Error saving image edits:', error);
      Alert.alert('Error', 'Failed to apply image edits. Please try again.');
      throw error;
    }
  };

  // Apply crop
  const applyCrop = async () => {
    try {
      if (!edits.cropArea) return;

      setIsCropping(false);

      // Generate preview
      const editedAsset = await applyEdits(currentImage, edits);
      setPreviewUri(editedAsset.uri);
    } catch (error) {
      logger.error('Error applying crop:', error);
      Alert.alert('Error', 'Failed to apply crop. Please try again.');
    }
  };

  // Cancel crop
  const cancelCrop = () => {
    setEdits((prev) => ({ ...prev, cropArea: null }));
    setIsCropping(false);
  };

  // Save all and close
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save current image if it has changes
      const hasChanges = edits.rotation !== 0 || edits.flipH || edits.flipV || edits.cropArea !== null;

      const finalEditedImages = new Map(editedImages);

      if (hasChanges && !editedImages.has(currentIndex)) {
        const edited = await saveCurrentImage();
        finalEditedImages.set(currentIndex, edited);
      }

      // Build final array of edited images
      const result: EditedImage[] = [];
      for (let i = 0; i < images.length; i++) {
        const edited = finalEditedImages.get(i);
        if (edited) {
          result.push(edited);
        } else {
          // Use original image unchanged
          result.push({
            originalAsset: images[i],
            editedAsset: images[i],
            edits: { ...DEFAULT_EDITS },
          });
        }
      }

      onSave(result);
    } catch (error) {
      logger.error('Error saving edits:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate between images
  const goToImage = async (index: number) => {
    // Auto-save current if it has changes
    const hasChanges = edits.rotation !== 0 || edits.flipH || edits.flipV || edits.cropArea !== null;

    if (hasChanges && !editedImages.has(currentIndex)) {
      try {
        await saveCurrentImage();
      } catch (error) {
        // Continue even if save fails
      }
    }

    setCurrentIndex(index);
  };

  if (!currentImage) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Edit Image {images.length > 1 ? `(${currentIndex + 1}/${images.length})` : ''}
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={resetEdits} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, styles.resetText]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.headerButton, styles.doneButton]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.doneButtonText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview area */}
        <View style={styles.previewContainer}>
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <ScrollView style={styles.controlsScroll}>
            {/* Rotation and flip controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transform</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={() => rotate('ccw')} style={styles.controlButton}>
                  <Text style={styles.controlButtonText}>↺</Text>
                  <Text style={styles.controlButtonLabel}>Rotate Left</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => rotate('cw')} style={styles.controlButton}>
                  <Text style={styles.controlButtonText}>↻</Text>
                  <Text style={styles.controlButtonLabel}>Rotate Right</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => flip('h')}
                  style={[styles.controlButton, edits.flipH && styles.controlButtonActive]}
                >
                  <Text style={styles.controlButtonText}>⇆</Text>
                  <Text style={styles.controlButtonLabel}>Flip H</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => flip('v')}
                  style={[styles.controlButton, edits.flipV && styles.controlButtonActive]}
                >
                  <Text style={styles.controlButtonText}>⇅</Text>
                  <Text style={styles.controlButtonLabel}>Flip V</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Crop controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Crop</Text>

              {/* Aspect ratio selection */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aspectRatioScroll}>
                {Object.entries(ASPECT_RATIOS).map(([key, { name }]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      setSelectedAspectRatio(key as AspectRatioKey);
                      if (!isCropping) {
                        initCrop();
                      }
                    }}
                    style={[
                      styles.aspectRatioButton,
                      selectedAspectRatio === key && styles.aspectRatioButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.aspectRatioButtonText,
                        selectedAspectRatio === key && styles.aspectRatioButtonTextActive,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Crop actions */}
              {!isCropping ? (
                <TouchableOpacity onPress={initCrop} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Start Crop</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.buttonRow}>
                  <TouchableOpacity onPress={cancelCrop} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={applyCrop} style={[styles.primaryButton, { flex: 1 }]}>
                    <Text style={styles.primaryButtonText}>Apply Crop</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isCropping && (
                <Text style={styles.cropHint}>
                  Crop will be applied with the selected aspect ratio
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Image thumbnails for multiple images */}
          {images.length > 1 && (
            <View style={styles.thumbnailsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsScroll}>
                {images.map((img, index) => {
                  const isEdited = editedImages.has(index);
                  const displayUri = editedImages.get(index)?.editedAsset.uri || img.uri;
                  return (
                    <TouchableOpacity
                      key={`thumb-${index}`}
                      onPress={() => goToImage(index)}
                      style={[
                        styles.thumbnail,
                        currentIndex === index && styles.thumbnailActive,
                      ]}
                    >
                      <Image
                        source={{ uri: displayUri }}
                        style={styles.thumbnailImage}
                        contentFit="cover"
                        transition={200}
                      />
                      {isEdited && (
                        <View style={styles.editedBadge}>
                          <Text style={styles.editedBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.borderDark,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.editorBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    headerButtonText: {
      color: colors.primary,
      fontSize: 16,
    },
    resetText: {
      color: colors.editorText,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    doneButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
    },
    doneButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    previewContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.borderDark,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    controls: {
      backgroundColor: colors.editorBackground,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    controlsScroll: {
      maxHeight: 300,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    controlButton: {
      flex: 1,
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.editorControl,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    controlButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    controlButtonText: {
      color: colors.text,
      fontSize: 24,
      marginBottom: 4,
    },
    controlButtonLabel: {
      color: colors.editorText,
      fontSize: 11,
    },
    aspectRatioScroll: {
      flexGrow: 0,
      flexShrink: 0,
      marginBottom: 12,
    },
    aspectRatioButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.editorControl,
      borderRadius: 16,
      marginRight: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    aspectRatioButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    aspectRatioButtonText: {
      color: colors.editorText,
      fontSize: 14,
    },
    aspectRatioButtonTextActive: {
      color: colors.text,
      fontWeight: '600',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.editorControl,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.editorBorder,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
    },
    cropHint: {
      color: colors.editorText,
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    thumbnailsContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    thumbnailsScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    thumbnail: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 2,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    thumbnailActive: {
      borderColor: colors.primary,
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    editedBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: colors.accentGreen,
      borderRadius: 10,
      width: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editedBadgeText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: 'bold',
    },
  });
}

export const ImageEditor = React.memo(ImageEditorInner, (prevProps, nextProps) => {
  if (prevProps.visible !== nextProps.visible) return false;
  if (prevProps.onSave !== nextProps.onSave) return false;
  if (prevProps.onCancel !== nextProps.onCancel) return false;
  if (prevProps.images.length !== nextProps.images.length) return false;
  if (prevProps.images !== nextProps.images) {
    for (let i = 0; i < prevProps.images.length; i++) {
      if (prevProps.images[i].uri !== nextProps.images[i].uri) return false;
    }
  }
  return true;
});
