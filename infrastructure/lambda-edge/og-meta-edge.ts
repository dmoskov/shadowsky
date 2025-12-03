/**
 * Lambda@Edge function for dynamic OG meta tag generation
 *
 * This function intercepts CloudFront requests and:
 * 1. Detects crawler User-Agents
 * 2. For thread/profile URLs, fetches data from Bluesky API
 * 3. Returns HTML with proper OG meta tags for crawlers
 * 4. Passes through to origin for regular users
 *
 * Deployment: Must be deployed in us-east-1 and attached to CloudFront
 */

import { CloudFrontRequestEvent, CloudFrontRequestResult, CloudFrontResponseResult } from 'aws-lambda';

// Crawler User-Agent patterns
const CRAWLER_USER_AGENTS = [
  'twitterbot',
  'facebookexternalhit',
  'facebot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'whatsapp',
  'telegrambot',
  'googlebot',
  'bingbot',
  'baiduspider',
  'yandex',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest',
  'applebot',
  'redditbot',
  'iframely',
];

interface BlueskyImage {
  thumb: string;
  fullsize: string;
  alt?: string;
}

interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  embed?: {
    $type: string;
    images?: BlueskyImage[];
    // For recordWithMedia embeds (quote posts with images)
    media?: {
      $type: string;
      images?: BlueskyImage[];
    };
    // For external embeds (link previews)
    external?: {
      uri: string;
      title: string;
      description: string;
      thumb?: string;
    };
  };
}

interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some(crawler => ua.includes(crawler));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

async function fetchWithTimeout(url: string, timeoutMs: number = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPostThread(handle: string, postId: string): Promise<BlueskyPost | null> {
  // Resolve handle to DID
  let did = handle;
  if (!handle.startsWith('did:')) {
    try {
      const resolveResponse = await fetchWithTimeout(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
      );
      if (!resolveResponse.ok) return null;
      const resolveData = await resolveResponse.json() as { did: string };
      did = resolveData.did;
    } catch {
      return null;
    }
  }

  // Fetch the post
  const uri = `at://${did}/app.bsky.feed.post/${postId}`;
  try {
    const response = await fetchWithTimeout(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`
    );
    if (!response.ok) return null;
    const data = await response.json() as { thread: { post: BlueskyPost } };
    return data.thread?.post || null;
  } catch {
    return null;
  }
}

async function fetchProfile(handle: string): Promise<BlueskyProfile | null> {
  try {
    const response = await fetchWithTimeout(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`
    );
    if (!response.ok) return null;
    return await response.json() as BlueskyProfile;
  } catch {
    return null;
  }
}

function getPostImage(post: BlueskyPost): string | null {
  const embed = post.embed;
  if (!embed) return null;

  // Direct image embed: app.bsky.embed.images#view
  if (embed.$type === 'app.bsky.embed.images#view' && embed.images?.length) {
    return embed.images[0].fullsize || embed.images[0].thumb;
  }

  // Quote post with media: app.bsky.embed.recordWithMedia#view
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media?.images?.length) {
    return embed.media.images[0].fullsize || embed.media.images[0].thumb;
  }

  // External link with thumbnail: app.bsky.embed.external#view
  if (embed.$type === 'app.bsky.embed.external#view' && embed.external?.thumb) {
    return embed.external.thumb;
  }

  return null;
}

function generateThreadOgHtml(post: BlueskyPost, handle: string, postId: string): string {
  const authorName = post.author.displayName || post.author.handle;
  const authorHandle = post.author.handle;
  const postText = post.record.text;
  const avatar = post.author.avatar;

  // Get post image if available, fall back to avatar
  const postImage = getPostImage(post);
  const ogImage = postImage || avatar || 'https://shadowsky.io/butterfly-icon.svg';

  const title = `${authorName} (@${authorHandle}) on ShadowSky`;
  const description = truncateText(postText, 200);
  const canonicalUrl = `https://shadowsky.io/thread/${handle}/${postId}`;
  const cardType = postImage ? 'summary_large_image' : 'summary';

  return generateHtml({
    title,
    description,
    ogImage,
    canonicalUrl,
    cardType,
    authorName,
    authorHandle,
  });
}

function generateProfileOgHtml(profile: BlueskyProfile, handle: string): string {
  const displayName = profile.displayName || profile.handle;
  const description = profile.description
    ? truncateText(profile.description, 200)
    : `${profile.followersCount || 0} followers · ${profile.postsCount || 0} posts`;
  const ogImage = profile.avatar || 'https://shadowsky.io/butterfly-icon.svg';
  const canonicalUrl = `https://shadowsky.io/profile/${handle}`;

  return generateHtml({
    title: `${displayName} (@${profile.handle}) - ShadowSky`,
    description,
    ogImage,
    canonicalUrl,
    cardType: 'summary',
    authorName: displayName,
    authorHandle: profile.handle,
  });
}

interface HtmlParams {
  title: string;
  description: string;
  ogImage: string;
  canonicalUrl: string;
  cardType: string;
  authorName: string;
  authorHandle: string;
}

function generateHtml(params: HtmlParams): string {
  const { title, description, ogImage, canonicalUrl, cardType, authorName, authorHandle } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">

  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:site_name" content="ShadowSky">
  <meta property="article:author" content="${escapeHtml(authorName)}">

  <meta name="twitter:card" content="${cardType}">
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:creator" content="@${escapeHtml(authorHandle)}">

  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="https://shadowsky.io/butterfly-icon.svg">

  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
  <script>window.location.href = "${escapeHtml(canonicalUrl)}";</script>
</head>
<body>
  <noscript>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(canonicalUrl)}">View on ShadowSky</a></p>
  </noscript>
</body>
</html>`;
}

function generateFallbackHtml(canonicalUrl: string): string {
  return generateHtml({
    title: 'ShadowSky - Bluesky Companion',
    description: 'Your companion app for deeper Bluesky insights',
    ogImage: 'https://shadowsky.io/butterfly-icon.svg',
    canonicalUrl,
    cardType: 'summary',
    authorName: 'ShadowSky',
    authorHandle: 'shadowsky',
  });
}

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult | CloudFrontResponseResult> => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const userAgent = request.headers['user-agent']?.[0]?.value;

  // Only process for crawlers
  if (!isCrawler(userAgent)) {
    return request; // Pass through to origin
  }

  // Match thread URLs: /thread/{handle}/{postId}
  const threadMatch = uri.match(/^\/thread\/([^/]+)\/([^/]+)$/);
  if (threadMatch) {
    const [, handle, postId] = threadMatch;
    const post = await fetchPostThread(handle, postId);
    const canonicalUrl = `https://shadowsky.io${uri}`;

    const html = post
      ? generateThreadOgHtml(post, handle, postId)
      : generateFallbackHtml(canonicalUrl);

    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
        'cache-control': [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      body: html,
    };
  }

  // Match profile URLs: /profile/{handle}
  const profileMatch = uri.match(/^\/profile\/([^/]+)$/);
  if (profileMatch) {
    const [, handle] = profileMatch;
    const profile = await fetchProfile(handle);
    const canonicalUrl = `https://shadowsky.io${uri}`;

    const html = profile
      ? generateProfileOgHtml(profile, handle)
      : generateFallbackHtml(canonicalUrl);

    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
        'cache-control': [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      body: html,
    };
  }

  // For other paths, pass through to origin
  return request;
};
