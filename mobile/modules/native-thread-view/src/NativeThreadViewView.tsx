import React from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

export type ThreadViewProps = ViewProps & {
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string;
  threadUri?: string;

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
};

const NativeView: React.ComponentType<ThreadViewProps> =
  requireNativeViewManager('NativeThreadView');

export default function NativeThreadViewView(props: ThreadViewProps) {
  return <NativeView {...props} />;
}
