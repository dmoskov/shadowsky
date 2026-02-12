import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, Alert } from "react-native";
import { ImageIcon, CloseIcon } from "./icons";
import { ImageAsset } from "../hooks/useImagePicker";
import { colors } from "../constants/theme";

const MAX_POST_LENGTH = 300;

export interface ThreadPost {
  text: string;
  images: ImageAsset[];
}

interface ThreadPostItemProps {
  post: ThreadPost;
  index: number;
  totalPosts: number;
  onTextChange: (text: string) => void;
  onImagesChange: (images: ImageAsset[]) => void;
  onRemove: () => void;
  onImagePicker: () => void;
  isUploading?: boolean;
  showRemoveButton: boolean;
}

export function ThreadPostItem({
  post,
  index,
  totalPosts,
  onTextChange,
  onImagesChange,
  onRemove,
  onImagePicker,
  isUploading = false,
  showRemoveButton,
}: ThreadPostItemProps) {
  const [altTextModalImage, setAltTextModalImage] = useState<number | null>(null);

  const handleRemoveImage = (imageIndex: number) => {
    Alert.alert(
      "Remove Image",
      "Are you sure you want to remove this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const newImages = post.images.filter((_, i) => i !== imageIndex);
            onImagesChange(newImages);
          },
        },
      ]
    );
  };

  const charCount = post.text.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;
  const canAddImages = post.images.length < 4;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.postNumber}>
          <Text style={styles.postNumberText}>
            {index + 1}/{totalPosts}
          </Text>
        </View>
        {showRemoveButton && (
          <TouchableOpacity
            onPress={onRemove}
            style={styles.removeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CloseIcon size={18} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.input}
        placeholder={`Post ${index + 1}`}
        placeholderTextColor="#6b7280"
        multiline
        value={post.text}
        onChangeText={onTextChange}
        editable={!isUploading}
      />

      {/* Image Previews */}
      {post.images.length > 0 && (
        <View style={styles.imagePreviewContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {post.images.map((image, imageIndex) => (
              <View key={imageIndex} style={styles.imagePreviewWrapper}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => handleRemoveImage(imageIndex)}
                  disabled={isUploading}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.altTextButton}
                  onPress={() => setAltTextModalImage(imageIndex)}
                  disabled={isUploading}
                >
                  <Text style={styles.altTextButtonText}>
                    {image.altText ? "✓ ALT" : "ALT"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.imageButton, !canAddImages && styles.imageButtonDisabled]}
          onPress={onImagePicker}
          disabled={!canAddImages || isUploading}
        >
          <ImageIcon size={18} color={canAddImages ? "#6b7280" : "#4b5563"} />
        </TouchableOpacity>
        <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
          {charCount}/{MAX_POST_LENGTH}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111116",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  postNumber: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  postNumberText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    padding: 4,
  },
  input: {
    color: "#ffffff",
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  imagePreviewContainer: {
    marginBottom: 8,
  },
  imagePreviewWrapper: {
    position: "relative",
    marginRight: 8,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: "#1f2937",
  },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 16,
  },
  altTextButton: {
    position: "absolute",
    bottom: 3,
    left: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  altTextButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  imageButton: {
    padding: 4,
  },
  imageButtonDisabled: {
    opacity: 0.5,
  },
  charCount: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
  },
  charCountOver: {
    color: "#ef4444",
  },
});
