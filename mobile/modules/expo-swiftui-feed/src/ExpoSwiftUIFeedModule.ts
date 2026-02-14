/**
 * TypeScript bridge for ExpoSwiftUIFeed module
 *
 * This module provides SwiftUI-based embed views for the BSKY mobile app.
 * The SwiftUI views are implemented in native iOS code and can be integrated
 * into React Native screens for better performance and native feel.
 */

export interface ImageEmbedData {
  thumb: string;
  fullsize: string;
  alt?: string;
  aspectRatio?: number;
}

export interface VideoEmbedData {
  playlist: string;
  thumbnail?: string;
  alt?: string;
  aspectRatio?: number;
}

export interface ExternalLinkEmbedData {
  uri: string;
  title?: string;
  description?: string;
  thumb?: string;
}

export interface AuthorData {
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface QuoteEmbedData {
  uri: string;
  author: AuthorData;
  text?: string;
  createdAt?: string;
}

/**
 * Embed type discriminator
 */
export type EmbedType =
  | { type: 'images'; images: ImageEmbedData[] }
  | { type: 'video'; video: VideoEmbedData }
  | { type: 'external'; external: ExternalLinkEmbedData }
  | { type: 'quote'; record: QuoteEmbedData | null }
  | { type: 'recordWithMedia'; media: EmbedType; record: QuoteEmbedData | null };

export interface PostEmbedData {
  embedType: EmbedType;
}

/**
 * Helper function to convert AT Protocol embed views to SwiftUI embed data
 * This mirrors the type guard logic from PostEmbed.tsx
 */
export function convertATProtoEmbedToSwiftUI(embed: any): PostEmbedData | null {
  if (!embed || !embed.$type) return null;

  const type = embed.$type;

  switch (type) {
    case 'app.bsky.embed.images#view':
      if (!embed.images || !Array.isArray(embed.images)) return null;
      return {
        embedType: {
          type: 'images',
          images: embed.images.map((img: any) => ({
            thumb: img.thumb,
            fullsize: img.fullsize,
            alt: img.alt,
            aspectRatio: img.aspectRatio,
          })),
        },
      };

    case 'app.bsky.embed.video#view':
      if (!embed.playlist) return null;
      return {
        embedType: {
          type: 'video',
          video: {
            playlist: embed.playlist,
            thumbnail: embed.thumbnail,
            alt: embed.alt,
            aspectRatio: embed.aspectRatio,
          },
        },
      };

    case 'app.bsky.embed.external#view':
      if (!embed.external || !embed.external.uri) return null;
      return {
        embedType: {
          type: 'external',
          external: {
            uri: embed.external.uri,
            title: embed.external.title,
            description: embed.external.description,
            thumb: embed.external.thumb,
          },
        },
      };

    case 'app.bsky.embed.record#view':
      const quoteRecord = parseQuoteRecord(embed.record);
      return {
        embedType: {
          type: 'quote',
          record: quoteRecord,
        },
      };

    case 'app.bsky.embed.recordWithMedia#view':
      const mediaEmbed = embed.media ? convertATProtoEmbedToSwiftUI(embed.media) : null;
      if (!mediaEmbed) return null;

      const nestedQuote =
        embed.record && embed.record.record
          ? parseQuoteRecord(embed.record.record)
          : null;

      return {
        embedType: {
          type: 'recordWithMedia',
          media: mediaEmbed.embedType,
          record: nestedQuote,
        },
      };

    default:
      return null;
  }
}

function parseQuoteRecord(recordDict: any): QuoteEmbedData | null {
  if (!recordDict || recordDict.$type !== 'app.bsky.embed.record#viewRecord') {
    return null;
  }

  if (!recordDict.uri || !recordDict.author || !recordDict.author.handle) {
    return null;
  }

  let text: string | undefined;
  if (recordDict.value && typeof recordDict.value === 'object' && 'text' in recordDict.value) {
    text = recordDict.value.text;
  }

  return {
    uri: recordDict.uri,
    author: {
      handle: recordDict.author.handle,
      displayName: recordDict.author.displayName,
      avatar: recordDict.author.avatar,
    },
    text,
    createdAt: recordDict.createdAt,
  };
}

export default {
  convertATProtoEmbedToSwiftUI,
};
