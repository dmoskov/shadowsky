import type { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";

// Crawler User-Agent patterns
const CRAWLER_USER_AGENTS = [
  "Twitterbot",
  "facebookexternalhit",
  "Facebot",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Googlebot",
  "bingbot",
  "Baiduspider",
  "yandex",
  "embedly",
  "Quora Link Preview",
  "showyoubot",
  "outbrain",
  "pinterest",
  "applebot",
  "redditbot",
  "iframely",
];

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
    embed?: {
      $type: string;
      images?: Array<{
        alt?: string;
        image: {
          ref: { $link: string };
          mimeType: string;
        };
      }>;
      external?: {
        uri: string;
        title: string;
        description: string;
        thumb?: {
          ref: { $link: string };
          mimeType: string;
        };
      };
    };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  embed?: {
    $type: string;
    images?: Array<{
      thumb: string;
      fullsize: string;
      alt?: string;
    }>;
  };
}

interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

interface ThreadResponse {
  thread: {
    post: BlueskyPost;
    replies?: Array<{ post: BlueskyPost }>;
  };
}

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((crawler) =>
    ua.includes(crawler.toLowerCase())
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

async function fetchPostThread(
  handle: string,
  postId: string
): Promise<ThreadResponse | null> {
  // Resolve handle to DID if needed
  let did = handle;
  if (!handle.startsWith("did:")) {
    try {
      const resolveResponse = await fetch(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
      );
      if (!resolveResponse.ok) {
        console.error(
          "Failed to resolve handle:",
          resolveResponse.status,
          await resolveResponse.text()
        );
        return null;
      }
      const resolveData = (await resolveResponse.json()) as { did: string };
      did = resolveData.did;
    } catch (error) {
      console.error("Error resolving handle:", error);
      return null;
    }
  }

  // Fetch the post thread
  const uri = `at://${did}/app.bsky.feed.post/${postId}`;
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`
    );
    if (!response.ok) {
      console.error(
        "Failed to fetch post:",
        response.status,
        await response.text()
      );
      return null;
    }
    return (await response.json()) as ThreadResponse;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}

function getPostImage(post: BlueskyPost): string | null {
  // Check for embedded images
  if (post.embed?.$type === "app.bsky.embed.images#view" && post.embed.images) {
    return post.embed.images[0]?.thumb || post.embed.images[0]?.fullsize || null;
  }

  // Check for record embed with images
  if (
    post.record.embed?.$type === "app.bsky.embed.images" &&
    post.record.embed.images
  ) {
    const img = post.record.embed.images[0];
    if (img?.image?.ref?.$link) {
      return `https://cdn.bsky.app/img/feed_thumbnail/plain/${post.author.did}/${img.image.ref.$link}@jpeg`;
    }
  }

  // Check for external embed with thumbnail
  if (
    post.record.embed?.$type === "app.bsky.embed.external" &&
    post.record.embed.external?.thumb
  ) {
    const thumb = post.record.embed.external.thumb;
    if (thumb?.ref?.$link) {
      return `https://cdn.bsky.app/img/feed_thumbnail/plain/${post.author.did}/${thumb.ref.$link}@jpeg`;
    }
  }

  return null;
}

function generateOgHtml(
  post: BlueskyPost,
  handle: string,
  postId: string,
  canonicalUrl: string
): string {
  const authorName = post.author.displayName || post.author.handle;
  const authorHandle = post.author.handle;
  const postText = post.record.text;
  const avatar = post.author.avatar;
  const postImage = getPostImage(post);

  // Use post image if available, otherwise fall back to avatar
  const ogImage = postImage || avatar || "https://shadowsky.io/og-image.png";

  // Create title and description
  const title = `${authorName} (@${authorHandle}) on ShadowSky`;
  const description = truncateText(postText, 200);

  // Format engagement stats
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;

  // Determine card type
  const cardType = postImage ? "summary_large_image" : "summary";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:site_name" content="ShadowSky">
  <meta property="article:author" content="${escapeHtml(authorName)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="${cardType}">
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:creator" content="@${escapeHtml(authorHandle)}">

  <!-- Additional Meta -->
  <meta property="og:locale" content="en_US">
  <meta name="author" content="${escapeHtml(authorName)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="https://shadowsky.io/asphodel-icon.svg">

  <!-- Redirect for non-crawlers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
  <script>window.location.href = "${escapeHtml(canonicalUrl)}";</script>
</head>
<body>
  <noscript>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(postText)}</p>
    <p>${likes} likes &middot; ${reposts} reposts &middot; ${replies} replies</p>
    <p><a href="${escapeHtml(canonicalUrl)}">View on ShadowSky</a></p>
  </noscript>
</body>
</html>`;
}

async function fetchProfile(handle: string): Promise<BlueskyProfile | null> {
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`
    );
    if (!response.ok) {
      console.error("Failed to fetch profile:", response.status);
      return null;
    }
    return (await response.json()) as BlueskyProfile;
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}

function generateProfileOgHtml(
  profile: BlueskyProfile,
  handle: string,
  canonicalUrl: string
): string {
  const displayName = profile.displayName || profile.handle;
  const description = profile.description
    ? truncateText(profile.description, 200)
    : `${profile.followersCount || 0} followers · ${profile.postsCount || 0} posts on Bluesky`;
  const ogImage = profile.avatar || "https://shadowsky.io/og-image.png";

  const title = `${displayName} (@${profile.handle}) - ShadowSky`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:site_name" content="ShadowSky">
  <meta property="profile:username" content="${escapeHtml(profile.handle)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">

  <!-- Additional Meta -->
  <meta property="og:locale" content="en_US">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="https://shadowsky.io/asphodel-icon.svg">

  <!-- Redirect for non-crawlers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
  <script>window.location.href = "${escapeHtml(canonicalUrl)}";</script>
</head>
<body>
  <noscript>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <p>${profile.followersCount || 0} followers &middot; ${profile.followsCount || 0} following &middot; ${profile.postsCount || 0} posts</p>
    <p><a href="${escapeHtml(canonicalUrl)}">View on ShadowSky</a></p>
  </noscript>
</body>
</html>`;
}

function generateFallbackHtml(
  canonicalUrl: string,
  type: "thread" | "profile" = "thread"
): string {
  const title = type === "profile" ? "Profile on ShadowSky" : "Thread on ShadowSky";
  const description = type === "profile"
    ? "View this Bluesky profile on ShadowSky"
    : "View this Bluesky thread on ShadowSky";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="https://shadowsky.io/og-image.png">
  <meta property="og:site_name" content="ShadowSky">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="https://shadowsky.io/og-image.png">

  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="https://shadowsky.io/asphodel-icon.svg">

  <!-- Redirect for non-crawlers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
  <script>window.location.href = "${escapeHtml(canonicalUrl)}";</script>
</head>
<body>
  <noscript>
    <h1>${title}</h1>
    <p><a href="${escapeHtml(canonicalUrl)}">View on ShadowSky</a></p>
  </noscript>
</body>
</html>`;
}

// Handler for thread OG tags
export const handler: APIGatewayProxyHandler = async (
  event
): Promise<APIGatewayProxyResult> => {
  const userAgent = event.headers["User-Agent"] || event.headers["user-agent"];
  const path = event.path || "";

  // Get path parameters from API Gateway
  const pathParams = event.pathParameters || {};

  // Determine if this is a thread or profile request
  const isProfileRequest = path.includes("/og/profile/");
  const isThreadRequest = path.includes("/og/thread/");

  let handle = pathParams.handle;
  let postId = pathParams.postId;

  // Fallback: parse from path if pathParameters not available
  if (isThreadRequest && (!handle || !postId)) {
    const threadMatch = path.match(/\/og\/thread\/([^/]+)\/([^/]+)/);
    if (threadMatch) {
      handle = threadMatch[1];
      postId = threadMatch[2];
    }
  } else if (isProfileRequest && !handle) {
    const profileMatch = path.match(/\/og\/profile\/([^/]+)/);
    if (profileMatch) {
      handle = profileMatch[1];
    }
  }

  // Handle profile requests
  if (isProfileRequest && handle) {
    const canonicalUrl = `https://shadowsky.io/profile/${handle}`;

    // For non-crawlers, redirect immediately
    if (!isCrawler(userAgent)) {
      return {
        statusCode: 302,
        headers: { Location: canonicalUrl, "Cache-Control": "no-cache" },
        body: "",
      };
    }

    try {
      const profile = await fetchProfile(handle);

      if (!profile) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
          body: generateFallbackHtml(canonicalUrl, "profile"),
        };
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
        body: generateProfileOgHtml(profile, handle, canonicalUrl),
      };
    } catch (error) {
      console.error("Error generating profile OG meta tags:", error);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
        body: generateFallbackHtml(canonicalUrl, "profile"),
      };
    }
  }

  // Handle thread requests
  if (!handle || !postId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid path. Expected /og/thread/:handle/:postId or /og/profile/:handle" }),
    };
  }

  const canonicalUrl = `https://shadowsky.io/thread/${handle}/${postId}`;

  // For non-crawlers, redirect immediately
  if (!isCrawler(userAgent)) {
    return {
      statusCode: 302,
      headers: { Location: canonicalUrl, "Cache-Control": "no-cache" },
      body: "",
    };
  }

  // For crawlers, fetch the post and generate OG tags
  try {
    const threadData = await fetchPostThread(handle, postId);

    if (!threadData?.thread?.post) {
      console.log("Post not found, returning fallback HTML");
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
        body: generateFallbackHtml(canonicalUrl, "thread"),
      };
    }

    const html = generateOgHtml(
      threadData.thread.post,
      handle,
      postId,
      canonicalUrl
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
      body: html,
    };
  } catch (error) {
    console.error("Error generating OG meta tags:", error);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
      body: generateFallbackHtml(canonicalUrl, "thread"),
    };
  }
};
