import React, {useMemo} from 'react';
import {Text} from 'react-native';
import {AppBskyFeedDefs, AppBskyEmbedImages, AppBskyEmbedExternal, AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo} from '@atproto/api';
import {ImageEmbed} from './ImageEmbed';
import {ExternalLinkEmbed} from './ExternalLinkEmbed';
import {GifEmbed} from './GifEmbed';
import {QuoteEmbed} from './QuoteEmbed';
import {VideoEmbed} from './VideoEmbed';
import {isTenorGifUri} from '../services/tenor';
import {InlineErrorBoundary} from './ui/InlineErrorBoundary';
import {useTheme} from '../contexts/ThemeContext';
import {fontSize} from '../utils/typography';

interface PostEmbedProps {
  embed: AppBskyFeedDefs.PostView['embed'];
  postUri?: string;
  postAuthorDid?: string;
  isVisible?: boolean;
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  blurImages?: boolean;
}

export function PostEmbed({
  embed,
  postUri,
  postAuthorDid,
  isVisible = false,
  onImagePress,
  onLinkPress,
  onQuotePress,
  blurImages = false,
}: PostEmbedProps) {
  const {colors} = useTheme();
  const embedFallback = useMemo(
    () => (
      <Text
        style={{
          fontSize: fontSize.footnote,
          color: colors.textSecondary,
          padding: 12,
          textAlign: 'center' as const,
        }}>
        Content unavailable
      </Text>
    ),
    [colors],
  );

  if (!embed) return null;

  // Type guard checks — each embed type is wrapped in its own error boundary
  // so a broken embed doesn't crash the entire post.
  if (AppBskyEmbedImages.isView(embed)) {
    return (
      <InlineErrorBoundary fallback={embedFallback} context="ImageEmbed">
        <ImageEmbed images={embed.images} onImagePress={onImagePress} blurImages={blurImages} postUri={postUri} postAuthorDid={postAuthorDid} />
      </InlineErrorBoundary>
    );
  }

  if (AppBskyEmbedExternal.isView(embed)) {
    if (isTenorGifUri(embed.external.uri)) {
      return (
        <InlineErrorBoundary fallback={embedFallback} context="GifEmbed">
          <GifEmbed
            uri={embed.external.uri}
            thumb={embed.external.thumb}
            description={embed.external.description}
            title={embed.external.title}
            isVisible={isVisible}
          />
        </InlineErrorBoundary>
      );
    }
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
              postAuthorDid={postAuthorDid}
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
