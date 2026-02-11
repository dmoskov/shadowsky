import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useCreatePost } from "../../hooks/api/usePosts";

const MAX_POST_LENGTH = 300;

export function ComposeScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const createPost = useCreatePost();

  const handleClose = () => {
    router.back();
  };

  const handlePost = async () => {
    if (!text.trim()) {
      return;
    }

    try {
      await createPost.mutateAsync({ text: text.trim() });
      router.back();
      // Show success feedback
      Alert.alert("Success", "Your post has been published!");
    } catch (error) {
      // Show error feedback
      const errorMessage = error instanceof Error ? error.message : "Failed to create post. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  };

  const isPostDisabled = !text.trim() || text.length > MAX_POST_LENGTH;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;

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
          {createPost.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="What's happening?"
        placeholderTextColor="#6b7280"
        multiline
        autoFocus
        value={text}
        onChangeText={setText}
        editable={!createPost.isPending}
      />

      <View style={styles.toolbar}>
        <Text style={styles.toolbarText}>Image | GIF | Poll | Thread</Text>
        <Text style={[
          styles.charCount,
          isOverLimit && styles.charCountOver
        ]}>
          {charCount}/{MAX_POST_LENGTH}
        </Text>
      </View>
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
  toolbarText: {
    color: "#6b7280",
    fontSize: 14,
  },
  charCount: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  charCountOver: {
    color: "#ef4444",
  },
});
