import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ImageIcon, VideoIcon, GifIcon, EmojiIcon, ThreadIcon, GlobeIcon, SparklesIcon } from "../../../components/icons";
import { useTheme } from "../../../contexts/ThemeContext";
import { getLanguageShortName } from "../../../constants/languages";
import type { ImageAsset } from "../../../hooks/useImagePicker";
import type { VideoAsset } from "../../../hooks/useVideoPicker";
import type { SelectedGif } from "../../../hooks/useGifPicker";

const MAX_POST_LENGTH = 300;

export interface ComposeToolbarProps {
  // Toolbar actions
  onImagePicker: () => void;
  onVideoPicker: () => void;
  onGifPicker: () => void;
  onEmojiPicker: () => void;
  onToggleThreadMode: () => void;
  onLanguagePickerOpen: () => void;
  onTonePicker: () => void;

  // State for toolbar buttons
  selectedImages: ImageAsset[];
  selectedVideo: VideoAsset | null;
  selectedGif: SelectedGif | null;
  isImageUploading: boolean;
  isVideoUploading: boolean;
  isThreadMode: boolean;
  replyTo?: any;
  quoteTo?: any;

  // Character count
  charCount: number;
  maxLength?: number;

  // Language selection
  selectedLanguages: string[];

  // AI tone state
  hasText: boolean;

  // Bottom inset for safe area
  bottomInset: number;
}

export function ComposeToolbar({
  onImagePicker,
  onVideoPicker,
  onGifPicker,
  onEmojiPicker,
  onToggleThreadMode,
  onLanguagePickerOpen,
  onTonePicker,
  selectedImages,
  selectedVideo,
  selectedGif,
  isImageUploading,
  isVideoUploading,
  isThreadMode,
  replyTo,
  quoteTo,
  charCount,
  maxLength = MAX_POST_LENGTH,
  selectedLanguages,
  hasText,
  bottomInset,
}: ComposeToolbarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isOverLimit = charCount > maxLength;

  if (isThreadMode) {
    return (
      <View style={[styles.toolbar, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <TouchableOpacity
          style={styles.exitThreadButton}
          activeOpacity={0.7}
          onPress={onToggleThreadMode}
        >
          <ThreadIcon size={18} color={colors.primary} />
          <Text style={styles.exitThreadText}>Exit Thread Mode</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.toolbar, { paddingBottom: Math.max(bottomInset, 16) }]}>
      <View style={styles.toolbarIcons}>
        <TouchableOpacity
          style={styles.toolbarButton}
          activeOpacity={0.7}
          onPress={onImagePicker}
          disabled={isImageUploading || selectedImages.length >= 4 || selectedVideo !== null}
        >
          <ImageIcon
            size={22}
            color={(selectedImages.length >= 4 || selectedVideo) ? colors.borderLight : colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          activeOpacity={0.7}
          onPress={onVideoPicker}
          disabled={isVideoUploading || selectedImages.length > 0 || selectedVideo !== null}
        >
          <VideoIcon
            size={22}
            color={(selectedImages.length > 0 || selectedVideo) ? colors.borderLight : colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          activeOpacity={0.7}
          onPress={onGifPicker}
          disabled={selectedImages.length > 0 || selectedVideo !== null || selectedGif !== null}
        >
          <GifIcon
            size={22}
            color={(selectedImages.length > 0 || selectedVideo || selectedGif) ? colors.borderLight : colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          activeOpacity={0.7}
          onPress={onEmojiPicker}
        >
          <EmojiIcon size={22} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          activeOpacity={0.7}
          onPress={onToggleThreadMode}
          disabled={replyTo !== undefined || quoteTo !== undefined}
        >
          <ThreadIcon size={22} color={isThreadMode ? colors.primary : colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          activeOpacity={0.7}
          onPress={onTonePicker}
          disabled={!hasText}
        >
          <SparklesIcon
            size={22}
            color={hasText ? colors.primary : colors.borderLight}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.languageButton}
          activeOpacity={0.7}
          onPress={onLanguagePickerOpen}
        >
          <GlobeIcon size={18} color={colors.textTertiary} />
          <Text style={styles.languageButtonText}>
            {selectedLanguages.length > 0
              ? selectedLanguages.map(getLanguageShortName).join(', ')
              : 'EN'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[
        styles.charCount,
        isOverLimit && styles.charCountOver
      ]}>
        {charCount}/{maxLength}
      </Text>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceElevated,
  },
  toolbarIcons: {
    flexDirection: "row",
    gap: 16,
  },
  toolbarButton: {
    padding: 4,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  languageButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  charCount: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: "500",
  },
  charCountOver: {
    color: colors.danger,
  },
  exitThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  exitThreadText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  });
}
