import React from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

export type ThreadViewProps = ViewProps & {
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string;
  threadUri?: string;

  // Summary props (JSON-serialized ThreadSummaryResult from JS)
  summaryJson?: string;
  isSummaryLoading?: boolean;
  summaryMode?: 'quick' | 'full';

  // Composer props (optional: set reply target from JS)
  replyToHandle?: string;
  replyToUri?: string;
  replyToCid?: string;

  // Event handlers
  onRefresh?: () => void;
  onPostPress?: (event: { nativeEvent: { uri: string; handle: string } }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onLike?: (event: { nativeEvent: { uri: string; cid: string; likeUri?: string } }) => void;
  onRepost?: (event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => void;
  onReply?: (event: { nativeEvent: { uri: string; cid: string; handle: string } }) => void;
  onBookmark?: (event: { nativeEvent: { uri: string } }) => void;
  onMentionPress?: (event: { nativeEvent: { handle: string; did: string } }) => void;
  onHashtagPress?: (event: { nativeEvent: { tag: string } }) => void;
  onShare?: (event: { nativeEvent: { uri: string } }) => void;
  onNavigateToParent?: (event: { nativeEvent: { uri: string } }) => void;
  onNavigateToRoot?: (event: { nativeEvent: { uri: string } }) => void;
  onPressLikeCount?: (event: { nativeEvent: { uri: string } }) => void;
  onPressRepostCount?: (event: { nativeEvent: { uri: string } }) => void;
  onPressQuoteCount?: (event: { nativeEvent: { uri: string } }) => void;
  onSummaryModeChange?: (event: { nativeEvent: { mode: string } }) => void;
  onTranslate?: (event: { nativeEvent: { uri: string; text: string; sourceLang: string } }) => void;
  onLinkPress?: (event: { nativeEvent: { uri: string } }) => void;
  onImagePress?: (event: { nativeEvent: { images: string; index: number } }) => void;
  onQuotePress?: (event: { nativeEvent: { uri: string; handle: string } }) => void;

  // Composer events (native -> JS)
  onSendReply?: (event: { nativeEvent: { text: string; replyToUri?: string; replyToCid?: string } }) => void;
  onOpenImagePicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onOpenGifPicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onOpenEmojiPicker?: (event: { nativeEvent: Record<string, never> }) => void;
  onMentionSearchQuery?: (event: { nativeEvent: { query: string } }) => void;
};

const NativeView: React.ComponentType<ThreadViewProps> =
  requireNativeViewManager('NativeThreadView');

export default function NativeThreadViewView(props: ThreadViewProps) {
  return <NativeView {...props} />;
}
