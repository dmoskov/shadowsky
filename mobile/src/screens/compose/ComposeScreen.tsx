import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { useCreatePost } from "../../hooks/api/usePosts";
import { ImageIcon, GifIcon, PollIcon, ThreadIcon, CloseIcon } from "../../components/icons";
import { Avatar } from "../../components/Avatar";

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

  const handleClose = () => {
    router.back();
  };

  const handlePost = async () => {
    if (!text.trim()) {
      return;
    }

    try {
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

      await createPost.mutateAsync(postOptions);
      router.back();
      // Show success feedback
      const successMessage = replyTo ? "Reply posted!" : quoteTo ? "Quote posted!" : "Your post has been published!";
      Alert.alert("Success", successMessage);
    } catch (error) {
      // Show error feedback
      const errorMessage = error instanceof Error ? error.message : "Failed to create post. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  };

  const isPostDisabled = !text.trim() || text.length > MAX_POST_LENGTH;
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
          {createPost.isPending ? (
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
        editable={!createPost.isPending}
      />

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
          <TouchableOpacity style={styles.toolbarButton} activeOpacity={0.7}>
            <ImageIcon size={22} color="#6b7280" />
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
});
