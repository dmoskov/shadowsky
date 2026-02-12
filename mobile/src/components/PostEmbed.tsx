import React from 'react';
import {AppBskyFeedDefs, AppBskyEmbedImages, AppBskyEmbedExternal, AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo} from '@atproto/api';
import {ImageEmbed} from './ImageEmbed';
import {ExternalLinkEmbed} from './ExternalLinkEmbed';
import {QuoteEmbed} from './QuoteEmbed';
import {VideoEmbed} from './VideoEmbed';

interface PostEmbedProps {
  embed: AppBskyFeedDefs.PostView['embed'];
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
}

export function PostEmbed({
  embed,
  onImagePress,
  onLinkPress,
  onQuotePress,
}: PostEmbedProps) {
  if (!embed) return null;

  // Type guard checks
  if (AppBskyEmbedImages.isView(embed)) {
    return <ImageEmbed images={embed.images} onImagePress={onImagePress} />;
  }

  if (AppBskyEmbedExternal.isView(embed)) {
    return <ExternalLinkEmbed external={embed.external} onPress={onLinkPress} />;
  }

  if (AppBskyEmbedRecord.isView(embed)) {
    return <QuoteEmbed record={embed.record} onPress={onQuotePress} />;
  }

  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    return (
      <>
        {embed.media && (
          <PostEmbed
            embed={embed.media as AppBskyFeedDefs.PostView['embed']}
            onImagePress={onImagePress}
            onLinkPress={onLinkPress}
            onQuotePress={onQuotePress}
          />
        )}
        {embed.record && (
          <QuoteEmbed record={embed.record.record} onPress={onQuotePress} />
        )}
      </>
    );
  }

  if (AppBskyEmbedVideo.isView(embed)) {
    return <VideoEmbed video={embed} onPress={onLinkPress} />;
  }

  return null;
}
