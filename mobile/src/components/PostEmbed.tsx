import React from 'react';
import {Text} from 'react-native';
import {AppBskyFeedDefs, AppBskyEmbedImages, AppBskyEmbedExternal, AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo} from '@atproto/api';
import {ImageEmbed} from './ImageEmbed';
import {ExternalLinkEmbed} from './ExternalLinkEmbed';
import {QuoteEmbed} from './QuoteEmbed';
import {VideoEmbed} from './VideoEmbed';
import {InlineErrorBoundary} from './ui/InlineErrorBoundary';

const embedFallbackStyle = { fontSize: 13, color: '#8899a6', padding: 12, textAlign: 'center' as const };
const embedFallback = <Text style={embedFallbackStyle}>Content unavailable</Text>;

interface PostEmbedProps {
  embed: AppBskyFeedDefs.PostView['embed'];
  postUri?: string;
  isVisible?: boolean;
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  blurImages?: boolean;
}

export function PostEmbed({
  embed,
  postUri,
  isVisible = false,
  onImagePress,
  onLinkPress,
  onQuotePress,
  blurImages = false,
}: PostEmbedProps) {
  if (!embed) return null;

  // Type guard checks — each embed type is wrapped in its own error boundary
  // so a broken embed doesn't crash the entire post.
  if (AppBskyEmbedImages.isView(embed)) {
    return (
      <InlineErrorBoundary fallback={embedFallback} context="ImageEmbed">
        <ImageEmbed images={embed.images} onImagePress={onImagePress} blurImages={blurImages} />
      </InlineErrorBoundary>
    );
  }

  if (AppBskyEmbedExternal.isView(embed)) {
    return (
      <InlineErrorBoundary fallback={embedFallback} context="ExternalLinkEmbed">
        <ExternalLinkEmbed external={embed.external} onPress={onLinkPress} />
      </InlineErrorBoundary>
    );
  }

  if (AppBskyEmbedRecord.isView(embed)) {
    return (
      <InlineErrorBoundary fallback={embedFallback} context="QuoteEmbed">
        <QuoteEmbed record={embed.record} onPress={onQuotePress} />
      </InlineErrorBoundary>
    );
  }

  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    return (
      <>
        {embed.media && (
          <InlineErrorBoundary fallback={embedFallback} context="RecordWithMedia.media">
            <PostEmbed
              embed={embed.media as AppBskyFeedDefs.PostView['embed']}
              postUri={postUri}
              isVisible={isVisible}
              onImagePress={onImagePress}
              onLinkPress={onLinkPress}
              onQuotePress={onQuotePress}
              blurImages={blurImages}
            />
          </InlineErrorBoundary>
        )}
        {embed.record && (
          <InlineErrorBoundary fallback={embedFallback} context="RecordWithMedia.record">
            <QuoteEmbed record={embed.record.record} onPress={onQuotePress} />
          </InlineErrorBoundary>
        )}
      </>
    );
  }

  if (AppBskyEmbedVideo.isView(embed)) {
    return (
      <InlineErrorBoundary fallback={embedFallback} context="VideoEmbed">
        <VideoEmbed video={embed} postUri={postUri} isVisible={isVisible} onPress={onLinkPress} />
      </InlineErrorBoundary>
    );
  }

  return null;
}
