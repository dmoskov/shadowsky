import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useCreatePost } from "../../hooks/api/usePosts";
import { ImageIcon, GifIcon, PollIcon, ThreadIcon, CloseIcon } from "../../components/icons";
import { Avatar } from "../../components/Avatar";
import { useImagePicker, ImageAsset } from "../../hooks/useImagePicker";

const MAX_POST_LENGTH = 300;

export interface ReplyToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface QuoteToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface ComposeScreenProps {
  replyTo?: ReplyToPost;
  quoteTo?: QuoteToPost;
}

export function ComposeScreen({ replyTo, quoteTo }: ComposeScreenProps = {}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const createPost = useCreatePost();
  const imagePicker = useImagePicker();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [altTextModalVisible, setAltTextModalVisible] = useState(false);
  const [tempAltText, setTempAltText] = useState("");

  const handleClose = () => {
    if (imagePicker.selectedImages.length > 0 || text.trim()) {
      Alert.alert(
        "Discard Post?",
        "Are you sure you want to discard this post?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      "Add Image",
      "Choose an option",
      [
        { text: "Take Photo", onPress: () => imagePicker.pickFromCamera() },
        { text: "Choose from Library", onPress: () => imagePicker.pickFromLibrary() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleRemoveImage = (index: number) => {
    Alert.alert(
      "Remove Image",
      "Are you sure you want to remove this image?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => imagePicker.removeImage(index) },
      ]
    );
  };

  const handleAddAltText = (index: number) => {
    setSelectedImageIndex(index);
    setTempAltText(imagePicker.selectedImages[index].altText);
    setAltTextModalVisible(true);
  };

  const handleSaveAltText = () => {
    if (selectedImageIndex !== null) {
      imagePicker.updateAltText(selectedImageIndex, tempAltText);
    }
    setAltTextModalVisible(false);
    setSelectedImageIndex(null);
    setTempAltText("");
  };

  const handlePost = async () => {
    if (!text.trim() && imagePicker.selectedImages.length === 0) {
      return;
    }

    try {
      imagePicker.setIsUploading(true);
      const postOptions: any = { text: text.trim() };

      // Add reply reference if replying
      if (replyTo) {
        postOptions.reply = {
          root: { uri: replyTo.uri, cid: replyTo.cid },
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        };
      }

      // Add quote reference if quoting
      if (quoteTo) {
        postOptions.quote = { uri: quoteTo.uri, cid: quoteTo.cid };
      }

      // Add images if any are selected
      if (imagePicker.selectedImages.length > 0) {
        postOptions.images = imagePicker.selectedImages.map((img) => ({
          uri: img.uri,
          alt: img.altText,
        }));
      }

      await createPost.mutateAsync(postOptions);
      imagePicker.clearImages();
      router.back();
      // Show success feedback
      const successMessage = replyTo ? "Reply posted!" : quoteTo ? "Quote posted!" : "Your post has been published!";
      Alert.alert("Success", successMessage);
    } catch (error) {
      // Show error feedback
      const errorMessage = error instanceof Error ? error.message : "Failed to create post. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      imagePicker.setIsUploading(false);
      imagePicker.setUploadProgress(0);
    }
  };

  const isPostDisabled = (!text.trim() && imagePicker.selectedImages.length === 0) ||
                         text.length > MAX_POST_LENGTH ||
                         imagePicker.isUploading;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;

  const placeholderText = replyTo
    ? "Post your reply"
    : quoteTo
    ? "Add your thoughts"
    : "What's happening?";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.cancelTouchable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.postButton,
            (isPostDisabled || createPost.isPending) && styles.postButtonDisabled
          ]}
          onPress={handlePost}
          disabled={isPostDisabled || createPost.isPending}
        >
          {createPost.isPending || imagePicker.isUploading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Reply Context */}
      {replyTo && (
        <View style={styles.replyContext}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyingTo}>
              Replying to @{replyTo.author.handle}
            </Text>
          </View>
          <View style={styles.parentPost}>
            <Avatar uri={replyTo.author.avatar} size={36} />
            <View style={styles.parentPostContent}>
              <View style={styles.parentPostHeader}>
                <Text style={styles.parentPostAuthor} numberOfLines={1}>
                  {replyTo.author.displayName || replyTo.author.handle}
                </Text>
                <Text style={styles.parentPostHandle} numberOfLines={1}>
                  @{replyTo.author.handle}
                </Text>
              </View>
              <Text style={styles.parentPostText} numberOfLines={2}>
                {replyTo.text}
              </Text>
            </View>
          </View>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder={placeholderText}
        placeholderTextColor="#6b7280"
        multiline
        autoFocus
        value={text}
        onChangeText={setText}
        editable={!createPost.isPending && !imagePicker.isUploading}
      />

      {/* Image Previews */}
      {imagePicker.selectedImages.length > 0 && (
        <View style={styles.imagePreviewContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScrollView}>
            {imagePicker.selectedImages.map((image, index) => (
              <View key={index} style={styles.imagePreviewWrapper}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                {imagePicker.isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#ffffff" size="small" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => handleRemoveImage(index)}
                  disabled={imagePicker.isUploading}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.altTextButton}
                  onPress={() => handleAddAltText(index)}
                  disabled={imagePicker.isUploading}
                >
                  <Text style={styles.altTextButtonText}>
                    {image.altText ? "✓ ALT" : "ALT"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          {imagePicker.isUploading && (
            <Text style={styles.uploadingText}>
              Uploading images...
            </Text>
          )}
        </View>
      )}

      {/* Quote Preview */}
      {quoteTo && (
        <View style={styles.quotePreview}>
          <View style={styles.quoteCard}>
            <View style={styles.quoteHeader}>
              <Avatar uri={quoteTo.author.avatar} size={32} />
              <View style={styles.quoteAuthorInfo}>
                <Text style={styles.quoteAuthorName} numberOfLines={1}>
                  {quoteTo.author.displayName || quoteTo.author.handle}
                </Text>
                <Text style={styles.quoteAuthorHandle} numberOfLines={1}>
                  @{quoteTo.author.handle}
                </Text>
              </View>
            </View>
            <Text style={styles.quoteText} numberOfLines={6}>
              {quoteTo.text}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.toolbarIcons}>
          <TouchableOpacity
            style={styles.toolbarButton}
            activeOpacity={0.7}
            onPress={handleImagePicker}
            disabled={imagePicker.isUploading || imagePicker.selectedImages.length >= 4}
          >
            <ImageIcon size={22} color={imagePicker.selectedImages.length >= 4 ? "#4b5563" : "#6b7280"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} activeOpacity={0.7}>
            <GifIcon size={22} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} activeOpacity={0.7}>
            <PollIcon size={22} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} activeOpacity={0.7}>
            <ThreadIcon size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <Text style={[
          styles.charCount,
          isOverLimit && styles.charCountOver
        ]}>
          {charCount}/{MAX_POST_LENGTH}
        </Text>
      </View>

      {/* Alt Text Modal */}
      <Modal
        visible={altTextModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAltTextModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Alt Text</Text>
              <TouchableOpacity onPress={() => setAltTextModalVisible(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Describe this image for people who are blind or have low vision.
            </Text>
            {selectedImageIndex !== null && (
              <Image
                source={{ uri: imagePicker.selectedImages[selectedImageIndex].uri }}
                style={styles.modalImage}
              />
            )}
            <TextInput
              style={styles.altTextInput}
              placeholder="Describe this image..."
              placeholderTextColor="#6b7280"
              multiline
              value={tempAltText}
              onChangeText={setTempAltText}
              maxLength={1000}
              autoFocus
            />
            <TouchableOpacity
              style={styles.saveAltTextButton}
              onPress={handleSaveAltText}
            >
              <Text style={styles.saveAltTextButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  cancelTouchable: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  cancelButton: {
    color: "#9ca3af",
    fontSize: 16,
  },
  postButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minHeight: 44,
    justifyContent: "center",
    minWidth: 70,
    alignItems: "center",
  },
  postButtonDisabled: {
    backgroundColor: "#1e3a5f",
    opacity: 0.5,
  },
  postButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 18,
    padding: 16,
    textAlignVertical: "top",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  toolbarIcons: {
    flexDirection: "row",
    gap: 16,
  },
  toolbarButton: {
    padding: 4,
  },
  charCount: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  charCountOver: {
    color: "#ef4444",
  },
  replyContext: {
    backgroundColor: "#111116",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyHeader: {
    marginBottom: 8,
  },
  replyingTo: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  parentPost: {
    flexDirection: "row",
    gap: 8,
  },
  parentPostContent: {
    flex: 1,
  },
  parentPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  parentPostAuthor: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    maxWidth: 150,
  },
  parentPostHandle: {
    color: "#6b7280",
    fontSize: 13,
    flex: 1,
  },
  parentPostText: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 18,
  },
  quotePreview: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quoteCard: {
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#111116",
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  quoteAuthorInfo: {
    flex: 1,
  },
  quoteAuthorName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  quoteAuthorHandle: {
    color: "#6b7280",
    fontSize: 13,
  },
  quoteText: {
    color: "#e5e7eb",
    fontSize: 14,
    lineHeight: 18,
  },
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
    backgroundColor: "#1f2937",
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
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#ffffff",
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
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  uploadingText: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0a0a0f",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalCloseButton: {
    color: "#9ca3af",
    fontSize: 32,
    lineHeight: 32,
  },
  modalDescription: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 12,
  },
  modalImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    marginBottom: 12,
    resizeMode: "contain",
  },
  altTextInput: {
    backgroundColor: "#111116",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  saveAltTextButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveAltTextButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
