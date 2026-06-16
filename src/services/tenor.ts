/**
 * GIF Service via Bluesky's KLIPY Proxy
 *
 * Uses Bluesky's GIF proxy at gifs.bsky.app which handles KLIPY API auth
 * server-side. No API key needed. KLIPY responses are normalized by the
 * proxy into the legacy Tenor `media_formats` schema, so downstream code
 * stays provider-agnostic.
 *
 * GIF delivery URLs are rewritten through k.gifs.bsky.app (KLIPY) or
 * t.gifs.bsky.app (legacy Tenor posts) for CDN delivery. This matches the
 * official Bluesky app's implementation.
 */

// Provider CDN hosts and their Bluesky proxy equivalents
const KLIPY_HOST = "static.klipy.com";
const KLIPY_PROXY = "k.gifs.bsky.app";
const TENOR_HOST = "media.tenor.com";
const TENOR_PROXY = "t.gifs.bsky.app";

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
    mp4?: TenorMediaFormat;
    webm?: TenorMediaFormat;
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

const GIF_SERVICE = "https://gifs.bsky.app";
const GIF_SEARCH_URL = (params: string) =>
  `${GIF_SERVICE}/klipy/v2/search?${params}`;
const GIF_FEATURED_URL = (params: string) =>
  `${GIF_SERVICE}/klipy/v2/featured?${params}`;
const CLIENT_KEY = "shadowsky-web";

function buildParams(extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set("client_key", CLIENT_KEY);
  params.set("limit", "30");
  params.set("contentfilter", "low"); // PG-13 equivalent

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
 * Search GIFs by query via Bluesky's KLIPY proxy
 */
export async function searchGifs(
  query: string,
  limit = 30,
): Promise<TenorGif[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const params = buildParams({ q: query, limit: limit.toString() });
    const response = await fetch(GIF_SEARCH_URL(params));

    if (!response.ok) {
      throw new Error(`GIF search error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error("Error searching GIFs:", error);
    throw error;
  }
}

/**
 * Get trending/featured GIFs via Bluesky's KLIPY proxy
 */
export async function getTrending(limit = 30): Promise<TenorGif[]> {
  try {
    const params = buildParams({ limit: limit.toString() });
    const response = await fetch(GIF_FEATURED_URL(params));

    if (!response.ok) {
      throw new Error(`GIF trending error: ${response.statusText}`);
    }

    const data: TenorSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error("Error loading trending GIFs:", error);
    throw error;
  }
}

/**
 * The filename slug (without extension) of a provider media URL. KLIPY uses
 * a different filename slug per format (unlike Tenor, which encodes the format
 * in the URL id), so the mp4/webm slugs must travel with the embed URL.
 */
function fileSlug(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const filename = url.split("/").pop();
  if (!filename) return undefined;
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : undefined;
}

/**
 * Rewrite a provider CDN URL (KLIPY or legacy Tenor) to the corresponding
 * Bluesky GIF proxy host. Leaves unrecognized hosts untouched.
 */
function gifUrlToProxy(gifUrl: string): string {
  try {
    const url = new URL(gifUrl);
    if (url.hostname === KLIPY_HOST) url.hostname = KLIPY_PROXY;
    else if (url.hostname === TENOR_HOST) url.hostname = TENOR_PROXY;
    return url.href;
  } catch {
    return gifUrl;
  }
}

/**
 * Best GIF URL for in-app display (picker thumbnails, compose preview),
 * proxied through the Bluesky CDN.
 */
export function getBestGifUrl(gif: TenorGif): string {
  const raw =
    gif.media_formats.tinygif?.url ||
    gif.media_formats.preview?.url ||
    gif.media_formats.gif?.url ||
    gif.media_formats.mediumgif?.url ||
    "";
  return raw ? gifUrlToProxy(raw) : "";
}

/**
 * Get GIF dimensions from the best available format.
 */
export function getGifDimensions(gif: TenorGif): {
  width: number;
  height: number;
} {
  const format =
    gif.media_formats.gif ||
    gif.media_formats.tinygif ||
    gif.media_formats.preview ||
    gif.media_formats.mediumgif;

  if (format && format.dims) {
    return {
      width: format.dims[0],
      height: format.dims[1],
    };
  }

  return { width: 0, height: 0 };
}

/**
 * Build the URI to store in the AT Protocol external embed record.
 *
 * IMPORTANT for interoperability: this returns the RAW provider URL
 * (static.klipy.com/...) with `?hh=&ww=` dimensions and, for KLIPY, the
 * `mp4`/`webm` filename slugs. Other Bluesky clients (including the official
 * app) detect a GIF by this exact host/path/params shape and rewrite it to
 * the proxy host themselves at render time. Do NOT store the proxied host.
 */
export function buildGifEmbedUri(gif: TenorGif): string {
  const format = gif.media_formats.gif;
  if (!format?.url) return getBestGifUrl(gif);

  const params = new URLSearchParams();
  const dims = format.dims;
  if (dims && dims[0] > 0 && dims[1] > 0) {
    params.set("hh", String(dims[1]));
    params.set("ww", String(dims[0]));
  }

  try {
    const url = new URL(format.url);
    if (url.hostname === KLIPY_HOST) {
      const mp4Slug = fileSlug(gif.media_formats.mp4?.url);
      const webmSlug = fileSlug(gif.media_formats.webm?.url);
      if (mp4Slug) params.set("mp4", mp4Slug);
      if (webmSlug) params.set("webm", webmSlug);
    }
  } catch {
    // fall through and return the URL with whatever params we have
  }

  const qs = params.toString();
  return qs ? `${format.url}?${qs}` : format.url;
}

/**
 * The static preview-frame URL to upload as the embed thumbnail.
 */
export function getGifThumbUrl(gif: TenorGif): string {
  return (
    gif.media_formats.preview?.url ||
    gif.media_formats.tinygif?.url ||
    gif.media_formats.gif?.url ||
    ""
  );
}

/**
 * Given a stored embed URI, return a proxied animated-GIF URL suitable for an
 * <img> tag. Handles both KLIPY and legacy Tenor URIs (and already-proxied
 * URIs). Strips the video-only slug params.
 */
export function getGifDisplayUrl(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.hostname === KLIPY_HOST) url.hostname = KLIPY_PROXY;
    else if (url.hostname === TENOR_HOST) url.hostname = TENOR_PROXY;
    url.searchParams.delete("mp4");
    url.searchParams.delete("webm");
    return url.href;
  } catch {
    return uri;
  }
}

/**
 * Whether a URI points at a GIF embed (KLIPY or legacy Tenor, raw or proxied).
 */
export function isGifEmbedUri(uri: string): boolean {
  try {
    const host = new URL(uri).hostname;
    return (
      host === KLIPY_HOST ||
      host === KLIPY_PROXY ||
      host === TENOR_HOST ||
      host === TENOR_PROXY
    );
  } catch {
    return false;
  }
}
