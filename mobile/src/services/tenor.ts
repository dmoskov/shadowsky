/**
 * GIF Service via Bluesky's Tenor Proxy
 *
 * Uses Bluesky's GIF proxy at gifs.bsky.app which handles Tenor API auth
 * server-side. No API key needed. GIF delivery URLs are rewritten through
 * t.gifs.bsky.app for CDN delivery.
 *
 * This matches the official Bluesky app's implementation.
 */

import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import { createLogger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/with-timeout';

const logger = createLogger('GifService');

const GIF_SERVICE = 'https://gifs.bsky.app';
const GIF_SEARCH_URL = (params: string) => `${GIF_SERVICE}/tenor/v2/search?${params}`;
const GIF_FEATURED_URL = (params: string) => `${GIF_SERVICE}/tenor/v2/featured?${params}`;

const CLIENT_KEY = Platform.select({
  ios: 'shadowsky-ios',
  android: 'shadowsky-android',
  default: 'shadowsky-web',
});

export interface TenorGif {
  id: string;
  title: string;
  content_description: string;
  created: number;
  hasaudio: boolean;
  media_formats: {
    tinygif?: TenorMediaFormat;
    gif?: TenorMediaFormat;
    mediumgif?: TenorMediaFormat;
    nanogif?: TenorMediaFormat;
    preview?: TenorMediaFormat;
  };
  url: string;
}

export interface TenorMediaFormat {
  url: string;
  duration: number;
  preview: string;
  dims: [number, number];
  size: number;
}

export interface TenorSearchResponse {
  results: TenorGif[];
  next: string;
}

function buildParams(extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set('client_key', CLIENT_KEY!);
  params.set('limit', '30');
  params.set('contentfilter', 'high');
  params.set('media_filter', 'preview,gif,tinygif');

  const locale = getLocales?.()?.[0];
  if (locale) {
    params.set('locale', locale.languageTag.replace('-', '_'));
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) {
        params.set(key, value);
      }
    }
  }

  return params.toString();
}

/**
 * Search GIFs by query via Bluesky's proxy
 */
export async function searchGifs(query: string, limit = 30): Promise<TenorGif[]> {
  if (!query.trim()) return [];

  try {
    const params = buildParams({ q: query, limit: limit.toString() });
    const response = await fetchWithTimeout(GIF_SEARCH_URL(params));

    if (!response.ok) {
      throw new Error(`GIF search error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    logger.error('Error searching GIFs:', error);
    throw error;
  }
}

/**
 * Get trending/featured GIFs via Bluesky's proxy
 */
export async function getTrending(limit = 30): Promise<TenorGif[]> {
  try {
    const params = buildParams({ limit: limit.toString() });
    const response = await fetchWithTimeout(GIF_FEATURED_URL(params));

    if (!response.ok) {
      throw new Error(`GIF trending error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    logger.error('Error loading trending GIFs:', error);
    throw error;
  }
}

/**
 * Rewrite a Tenor media URL to go through Bluesky's GIF CDN proxy.
 * This matches the official Bluesky app behavior.
 */
export function tenorUrlToBskyGifUrl(tenorUrl: string): string {
  try {
    const url = new URL(tenorUrl);
    url.hostname = 't.gifs.bsky.app';
    return url.href;
  } catch {
    logger.error('Invalid URL passed to tenorUrlToBskyGifUrl()');
    return '';
  }
}

/**
 * Get the best GIF URL for embedding, proxied through Bluesky CDN
 */
export function getBestGifUrl(gif: TenorGif): string {
  const raw =
    gif.media_formats.tinygif?.url ||
    gif.media_formats.preview?.url ||
    gif.media_formats.gif?.url ||
    gif.media_formats.mediumgif?.url ||
    '';
  return raw ? tenorUrlToBskyGifUrl(raw) : '';
}

/**
 * Get GIF dimensions
 */
export function getGifDimensions(gif: TenorGif): { width: number; height: number } {
  const format =
    gif.media_formats.tinygif ||
    gif.media_formats.preview ||
    gif.media_formats.gif ||
    gif.media_formats.mediumgif;

  if (format?.dims) {
    return { width: format.dims[0], height: format.dims[1] };
  }
  return { width: 0, height: 0 };
}
