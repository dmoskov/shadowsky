/**
 * MobileComposeScreen - Full-screen compose view for React Native
 *
 * Provides a text input area with character count, a navigation bar with
 * Post/Cancel, and the MobileAIToolbar for AI-powered features
 * (tone adjustment, writing feedback, and suggestions).
 *
 * This component is designed to be presented modally from the feed or
 * post detail screens.
 */

import { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../hooks/useDynamicType";
import { useMobileComposerAI } from "../hooks/useMobileComposerAI";
import { MobileAIToolbar } from "./MobileAIToolbar";

import { spacing } from "../../theme/spacing";
const MAX_POST_LENGTH = 300;

// ─── Props ───────────────────────────────────────────────────────────

export interface MobileComposeScreenProps {
  /** Called when the user submits the post */
  onPost: (text: string) => void;
  /** Called when the user cancels composing */
  onCancel: () => void;
  /** Initial text (e.g. for replies or quotes) */
  initialText?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the post is being submitted */
  isPosting?: boolean;
  /** Optional reply context display */
  replyTo?: {
    authorHandle: string;
    text: string;
  };
}

// ─── Styles ──────────────────────────────────────────────────────────

function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#ffffff",
    } as ViewStyle,
    navBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e5e7eb",
      minHeight: 54,
    } as ViewStyle,
    cancelText: {
      fontSize: scaledFont(16),
      color: "#6b7280",
      minHeight: 44,
      paddingVertical: spacing.md,
    } as TextStyle,
    postButton: {
      backgroundColor: "#4f46e5",
      borderRadius: 20,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      minHeight: 36,
      justifyContent: "center",
    } as ViewStyle,
    postButtonDisabled: {
      backgroundColor: "#c7d2fe",
    } as ViewStyle,
    postButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "700",
      color: "#ffffff",
    } as TextStyle,
    replyContext: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: "#f9fafb",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e5e7eb",
    } as ViewStyle,
    replyHandle: {
      fontSize: scaledFont(13),
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
      fontWeight: "600",
      color: "#4f46e5",
      marginBottom: spacing.xxs,
    } as TextStyle,
    replyText: {
      fontSize: scaledFont(13),
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
      color: "#6b7280",
    } as TextStyle,
    inputArea: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    } as ViewStyle,
    textInput: {
      fontSize: scaledFont(17),
      lineHeight: scaledLineHeight(scaledFont, 17, 24),
      color: "#111827",
      flex: 1,
      textAlignVertical: "top",
    } as TextStyle,
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#e5e7eb",
    } as ViewStyle,
    charCount: {
      fontSize: scaledFont(13),
      color: "#9ca3af",
      textAlign: "right",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    } as TextStyle,
    charCountWarning: {
      color: "#f59e0b",
    } as TextStyle,
    charCountOver: {
      color: "#ef4444",
      fontWeight: "700",
    } as TextStyle,
  });
}

// ─── Component ───────────────────────────────────────────────────────

export const MobileComposeScreen = memo<MobileComposeScreenProps>(
  ({
    onPost,
    onCancel,
    initialText = "",
    placeholder = "What's on your mind?",
    isPosting = false,
    replyTo,
  }) => {
    const [text, setText] = useState(initialText);
    const { scaledFont } = useDynamicType();
    const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

    const ai = useMobileComposerAI();

    const charCount = text.length;
    const canPost = charCount > 0 && charCount <= MAX_POST_LENGTH && !isPosting;

    const handlePost = useCallback(() => {
      if (canPost) onPost(text);
    }, [canPost, onPost, text]);

    // AI features callback: when the AI produces new text, replace the input
    const handleApplyAIText = useCallback((newText: string) => {
      setText(newText);
    }, []);

    return (
      <View style={styles.container}>
        {/* Navigation bar */}
        <View style={styles.navBar}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!canPost}
            accessibilityRole="button"
            accessibilityLabel="Post"
          >
            <Text style={styles.postButtonText}>
              {isPosting ? "Posting..." : "Post"}
            </Text>
          </Pressable>
        </View>

        {/* Reply context */}
        {replyTo && (
          <View style={styles.replyContext}>
            <Text style={styles.replyHandle}>@{replyTo.authorHandle}</Text>
            <Text style={styles.replyText} numberOfLines={2}>
              {replyTo.text}
            </Text>
          </View>
        )}

        {/* Text input */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            multiline
            autoFocus
            accessibilityLabel="Compose post"
          />
        </View>

        {/* Footer with char count + AI toolbar */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.charCount,
              charCount > MAX_POST_LENGTH * 0.9 &&
                charCount <= MAX_POST_LENGTH &&
                styles.charCountWarning,
              charCount > MAX_POST_LENGTH && styles.charCountOver,
            ]}
          >
            {charCount}/{MAX_POST_LENGTH}
          </Text>

          <MobileAIToolbar
            text={text}
            showToneOptions={ai.showToneOptions}
            selectedTone={ai.selectedTone}
            isAdjustingTone={ai.isAdjustingTone}
            tonePreview={ai.tonePreview}
            showTonePreview={ai.showTonePreview}
            onToggleToneOptions={ai.onToggleToneOptions}
            onToneAdjustment={ai.onToneAdjustment}
            onApplyTone={ai.onApplyTone}
            onCancelTone={ai.onCancelTone}
            writingFeedback={ai.writingFeedback}
            isLoadingFeedback={ai.isLoadingFeedback}
            showWritingFeedback={ai.showWritingFeedback}
            onRequestFeedback={ai.onRequestFeedback}
            onCloseFeedback={ai.onCloseFeedback}
            onApplyCorrected={ai.onApplyCorrected}
            onApplyEnhanced={ai.onApplyEnhanced}
            onApplyText={handleApplyAIText}
            error={ai.error}
            clearError={ai.clearError}
          />
        </View>
      </View>
    );
  },
);
MobileComposeScreen.displayName = "MobileComposeScreen";

export default MobileComposeScreen;
