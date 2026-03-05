import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { ThreadPostItem, ThreadPost } from "./ThreadPostItem";
import { useTheme } from "../contexts/ThemeContext";
import {fontSize} from '../utils/typography';

interface ThreadComposerProps {
  posts: ThreadPost[];
  onUpdatePost: (index: number, post: ThreadPost) => void;
  onAddPost: () => void;
  onRemovePost: (index: number) => void;
  onImagePicker: (postIndex: number) => void;
  isUploading?: boolean;
}

export function ThreadComposer({
  posts,
  onUpdatePost,
  onAddPost,
  onRemovePost,
  onImagePicker,
  isUploading = false,
}: ThreadComposerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleRemovePost = (index: number) => {
    if (posts.length <= 1) {
      Alert.alert("Cannot Remove", "A thread must have at least one post.");
      return;
    }

    Alert.alert(
      "Remove Post",
      `Remove post ${index + 1} from thread?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => onRemovePost(index) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Thread Composer</Text>
        <View style={styles.threadBadge}>
          <Text style={styles.threadBadgeText}>{posts.length} posts</Text>
        </View>
      </View>

      <ScrollView style={styles.postsContainer} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
        {posts.map((post, index) => (
          <ThreadPostItem
            key={index}
            post={post}
            index={index}
            totalPosts={posts.length}
            onTextChange={(text) => onUpdatePost(index, { ...post, text })}
            onImagesChange={(images) => onUpdatePost(index, { ...post, images })}
            onRemove={() => handleRemovePost(index)}
            onImagePicker={() => onImagePicker(index)}
            isUploading={isUploading}
            showRemoveButton={posts.length > 1}
          />
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.addPostButton, isUploading && styles.addPostButtonDisabled]}
        onPress={onAddPost}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel="Add post to thread"
        accessibilityHint={`Double tap to add another post to this ${posts.length} post thread`}
        accessibilityState={{disabled: isUploading}}
      >
        <Text style={styles.addPostButtonText}>+ Add Post to Thread</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    headerText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
    threadBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    threadBadgeText: {
      color: colors.text,
      fontSize: fontSize.caption1,
      fontWeight: "600",
    },
    postsContainer: {
      flex: 1,
      padding: 16,
    },
    addPostButton: {
      backgroundColor: colors.surfaceElevated,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      borderRadius: 8,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderStyle: "dashed",
    },
    addPostButtonDisabled: {
      opacity: 0.5,
    },
    addPostButtonText: {
      color: colors.primary,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
  });
}
