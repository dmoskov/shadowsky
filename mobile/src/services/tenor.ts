/**
 * Tenor API Service
 *
 * Provides GIF search functionality using Tenor API v2
 * https://developers.google.com/tenor/guides/quickstart
 */

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

// For React Native, we'll use expo-constants to access environment variables
import Constants from 'expo-constants';


import { createLogger } from '../utils/logger';

const logger = createLogger('Tenor');
const TENOR_API_KEY = Constants.expoConfig?.extra?.tenorApiKey || "";
const TENOR_API_BASE = "https://tenor.googleapis.com/v2";
const CLIENT_KEY = "shadowsky"; // Client key for tracking

/**
 * Search GIFs by query
 */
export async function searchGifs(
  query: string,
  limit = 20,
): Promise<TenorGif[]> {
  if (!TENOR_API_KEY) {
    throw new Error("Tenor API key not configured");
  }

  if (!query.trim()) {
    return [];
  }

  try {
    const url = new URL(`${TENOR_API_BASE}/search`);
    url.searchParams.append("q", query);
    url.searchParams.append("key", TENOR_API_KEY);
    url.searchParams.append("client_key", CLIENT_KEY);
    url.searchParams.append("limit", limit.toString());
    url.searchParams.append("media_filter", "tinygif,gif,mediumgif");
    url.searchParams.append("contentfilter", "medium"); // Safe content filter

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Tenor API error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    logger.error('Error searching Tenor GIFs:', error);
    throw error;
  }
}

/**
 * Get trending/featured GIFs
 */
export async function getTrending(limit = 20): Promise<TenorGif[]> {
  if (!TENOR_API_KEY) {
    throw new Error("Tenor API key not configured");
  }

  try {
    const url = new URL(`${TENOR_API_BASE}/featured`);
    url.searchParams.append("key", TENOR_API_KEY);
    url.searchParams.append("client_key", CLIENT_KEY);
    url.searchParams.append("limit", limit.toString());
    url.searchParams.append("media_filter", "tinygif,gif,mediumgif");
    url.searchParams.append("contentfilter", "medium");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Tenor API error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    logger.error('Error loading trending GIFs:', error);
    throw error;
  }
}

/**
 * Get a specific GIF by ID
 */
export async function getGifById(id: string): Promise<TenorGif | null> {
  if (!TENOR_API_KEY) {
    throw new Error("Tenor API key not configured");
  }

  try {
    const url = new URL(`${TENOR_API_BASE}/posts`);
    url.searchParams.append("ids", id);
    url.searchParams.append("key", TENOR_API_KEY);
    url.searchParams.append("client_key", CLIENT_KEY);
    url.searchParams.append("media_filter", "tinygif,gif,mediumgif");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Tenor API error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results[0] || null;
  } catch (error) {
    logger.error('Error fetching GIF by ID:', error);
    throw error;
  }
}

/**
 * Get the best GIF URL for embedding
 * Prefers smaller formats for performance while maintaining quality
 */
export function getBestGifUrl(gif: TenorGif): string {
  // Priority: tinygif > nanogif > mediumgif > gif
  // tinygif is optimized for performance
  if (gif.media_formats.tinygif) {
    return gif.media_formats.tinygif.url;
  }
  if (gif.media_formats.nanogif) {
    return gif.media_formats.nanogif.url;
  }
  if (gif.media_formats.mediumgif) {
    return gif.media_formats.mediumgif.url;
  }
  if (gif.media_formats.gif) {
    return gif.media_formats.gif.url;
  }
  return "";
}

/**
 * Get GIF dimensions
 */
export function getGifDimensions(gif: TenorGif): {
  width: number;
  height: number;
} {
  // Get dimensions from the best available format
  const format =
    gif.media_formats.tinygif ||
    gif.media_formats.nanogif ||
    gif.media_formats.mediumgif ||
    gif.media_formats.gif;

  if (format && format.dims) {
    return {
      width: format.dims[0],
      height: format.dims[1],
    };
  }

  return { width: 0, height: 0 };
}
