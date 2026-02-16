import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { VideoIcon } from "../../../components/icons";
import type { ImageAsset } from "../../../hooks/useImagePicker";
import type { VideoAsset } from "../../../hooks/useVideoPicker";
import type { SelectedGif } from "../../../hooks/useGifPicker";

export interface ComposeMediaPreviewProps {
  // Image preview
  selectedImages: ImageAsset[];
  onRemoveImage: (index: number) => void;
  onAddAltText: (index: number) => void;
  isImageUploading: boolean;

  // Video preview
  selectedVideo: VideoAsset | null;
  onRemoveVideo: () => void;
  formatVideoDuration: (duration: number) => string;
  isVideoUploading: boolean;

  // GIF preview
  selectedGif: SelectedGif | null;
  onRemoveGif: () => void;
}

export function ComposeMediaPreview({
  selectedImages,
  onRemoveImage,
  onAddAltText,
  isImageUploading,
  selectedVideo,
  onRemoveVideo,
  formatVideoDuration,
  isVideoUploading,
  selectedGif,
  onRemoveGif,
}: ComposeMediaPreviewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Image Previews
  if (selectedImages.length > 0) {
    return (
      <View style={styles.imagePreviewContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScrollView}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.imagePreviewWrapper}>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              {isImageUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color={colors.text} size="small" />
                </View>
              )}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemoveImage(index)}
                disabled={isImageUploading}
              >
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.altTextButton}
                onPress={() => onAddAltText(index)}
                disabled={isImageUploading}
              >
                <Text style={styles.altTextButtonText}>
                  {image.altText ? "✓ ALT" : "ALT"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        {isImageUploading && (
          <Text style={styles.uploadingText}>
            Uploading images...
          </Text>
        )}
      </View>
    );
  }

  // Video Preview
  if (selectedVideo) {
    return (
      <View style={styles.videoPreviewContainer}>
        <View style={styles.videoPreviewWrapper}>
          {selectedVideo.thumbnail ? (
            <Image
              source={{ uri: selectedVideo.thumbnail }}
              style={styles.videoPreview}
            />
          ) : (
            <View style={[styles.videoPreview, styles.videoPreviewPlaceholder]}>
              <VideoIcon size={48} color={colors.textTertiary} />
            </View>
          )}
          {isVideoUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={colors.text} size="small" />
            </View>
          )}
          <View style={styles.videoDurationBadge}>
            <Text style={styles.videoDurationText}>
              {formatVideoDuration(selectedVideo.duration)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={onRemoveVideo}
            disabled={isVideoUploading}
          >
            <Text style={styles.removeText}>×</Text>
          </TouchableOpacity>
          <View style={styles.videoPlayIcon}>
            <View style={styles.playIconTriangle} />
          </View>
        </View>
        {isVideoUploading && (
          <Text style={styles.uploadingText}>
            Uploading video... This may take a while.
          </Text>
        )}
      </View>
    );
  }

  // GIF Preview
  if (selectedGif) {
    return (
      <View style={styles.gifPreviewContainer}>
        <View style={styles.gifPreviewWrapper}>
          <Image
            source={{ uri: selectedGif.url }}
            style={styles.gifPreview}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={onRemoveGif}
          >
            <Text style={styles.removeText}>×</Text>
          </TouchableOpacity>
          <View style={styles.gifBadge}>
            <Text style={styles.gifBadgeText}>GIF</Text>
          </View>
        </View>
        <Text style={styles.gifHintText}>
          GIFs are embedded as external links
        </Text>
      </View>
    );
  }

  return null;
}

function createStyles(colors: any) {
  return StyleSheet.create({
  imagePreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  imageScrollView: {
    flexDirection: "row",
  },
  imagePreviewWrapper: {
    position: "relative",
    marginRight: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  altTextButton: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  altTextButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "600",
  },
  uploadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  videoPreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  videoPreviewWrapper: {
    position: "relative",
    width: 200,
    height: 200,
  },
  videoPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  videoPreviewPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  videoDurationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoDurationText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  videoPlayIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIconTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderLeftWidth: 14,
    borderLeftColor: colors.text,
    borderTopWidth: 9,
    borderTopColor: "transparent",
    borderBottomWidth: 9,
    borderBottomColor: "transparent",
  },
  gifPreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  gifPreviewWrapper: {
    position: "relative",
    width: 200,
    height: 200,
  },
  gifPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  gifBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  gifBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  gifHintText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },
  });
}
