import React from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

export type NativeComposeViewProps = ViewProps & {
  // Content
  text?: string;
  draftId?: string;
  selectedLanguages?: string; // JSON array string

  // Media (JSON array of MediaAttachment objects)
  mediaJson?: string;

  // Reply/Quote context (JSON strings)
  replyToJson?: string;
  quoteToJson?: string;

  // Thread mode
  isThreadMode?: boolean;
  threadPostsJson?: string; // JSON array of thread posts

  // State
  isPosting?: boolean;
  isUploading?: boolean;

  // Navigation events
  onClose?: (event: { nativeEvent: Record<string, never> }) => void;
  onOpenDrafts?: (event: { nativeEvent: Record<string, never> }) => void;

  // Post events
  onPost?: (event: { nativeEvent: { text: string; isThreadMode: boolean; languages?: string[]; threadPosts?: Array<{ text: string; images: any[] }> } }) => void;
  onSaveDraft?: (event: { nativeEvent: { text: string; draftId?: string } }) => void;
  onTextChange?: (event: { nativeEvent: { text: string } }) => void;

  // Media events
  onImagePicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onVideoPicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onGifPicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onEmojiPicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onLanguagePicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onRemoveMedia?: (event: { nativeEvent: { index: number } }) => void;
  onEditAltText?: (event: { nativeEvent: { index: number } }) => void;
  onGenerateAltText?: (event: { nativeEvent: { index: number } }) => void;
  onSaveAltText?: (event: { nativeEvent: { index: number; altText: string } }) => void;

  // Thread events
  onToggleThreadMode?: (event: { nativeEvent: { isThreadMode: boolean } }) => void;
  onAddThreadPost?: (event: { nativeEvent: Record<string, never> }) => void;
  onRemoveThreadPost?: (event: { nativeEvent: { index: number } }) => void;
  onUpdateThreadPost?: (event: { nativeEvent: { index: number; text: string } }) => void;
  onThreadImagePicker?: (event: { nativeEvent: { index: number } }) => void;

  // Mention events
  onMentionSearch?: (event: { nativeEvent: { query: string } }) => void;
};

const NativeView: React.ComponentType<NativeComposeViewProps> =
  requireNativeViewManager('NativeCompose');

export default function NativeComposeView(props: NativeComposeViewProps) {
  return <NativeView {...props} />;
}
