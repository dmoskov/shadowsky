"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// og-meta-edge.ts
var og_meta_edge_exports = {};
__export(og_meta_edge_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(og_meta_edge_exports);
var CRAWLER_USER_AGENTS = [
  "twitterbot",
  "facebookexternalhit",
  "facebot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "whatsapp",
  "telegrambot",
  "googlebot",
  "bingbot",
  "baiduspider",
  "yandex",
  "embedly",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "pinterest",
  "applebot",
  "redditbot",
  "iframely"
];
function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((crawler) => ua.includes(crawler));
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
async function fetchPostThread(handle, postId) {
  let did = handle;
  if (!handle.startsWith("did:")) {
    try {
      const resolveResponse = await fetch(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
      );
      if (!resolveResponse.ok) return null;
      const resolveData = await resolveResponse.json();
      did = resolveData.did;
    } catch {
      return null;
    }
  }
  const uri = `at://${did}/app.bsky.feed.post/${postId}`;
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.thread?.post || null;
  } catch {
    return null;
  }
}
async function fetchProfile(handle) {
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
function getPostImage(post) {
  const embed = post.embed;
  if (!embed) return null;
  if (embed.$type === "app.bsky.embed.images#view" && embed.images?.length) {
    return embed.images[0].fullsize || embed.images[0].thumb;
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view" && embed.media?.images?.length) {
    return embed.media.images[0].fullsize || embed.media.images[0].thumb;
  }
  if (embed.$type === "app.bsky.embed.external#view" && embed.external?.thumb) {
    return embed.external.thumb;
  }
  return null;
}
function generateThreadOgHtml(post, handle, postId) {
  const authorName = post.author.displayName || post.author.handle;
  const authorHandle = post.author.handle;
  const postText = post.record.text;
  const avatar = post.author.avatar;
  const postImage = getPostImage(post);
  const ogImage = postImage || avatar || "https://shadowsky.io/og-image.png";
  const title = `${authorName} (@${authorHandle}) on ShadowSky`;
  const description = truncateText(postText, 200);
  const canonicalUrl = `https://shadowsky.io/thread/${handle}/${postId}`;
  const cardType = postImage ? "summary_large_image" : "summary";
  return generateHtml({
    title,
    description,
    ogImage,
    canonicalUrl,
    cardType,
    authorName,
    authorHandle
  });
}
function generateProfileOgHtml(profile, handle) {
  const displayName = profile.displayName || profile.handle;
  const description = profile.description ? truncateText(profile.description, 200) : `${profile.followersCount || 0} followers \xB7 ${profile.postsCount || 0} posts`;
  const ogImage = profile.avatar || "https://shadowsky.io/og-image.png";
  const canonicalUrl = `https://shadowsky.io/profile/${handle}`;
  return generateHtml({
    title: `${displayName} (@${profile.handle}) - ShadowSky`,
    description,
    ogImage,
    canonicalUrl,
    cardType: "summary",
    authorName: displayName,
    authorHandle: profile.handle
  });
}
function generateHtml(params) {
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
  <link rel="icon" type="image/svg+xml" href="https://shadowsky.io/asphodel-icon.svg">

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
function generateFallbackHtml(canonicalUrl) {
  return generateHtml({
    title: "ShadowSky - Bluesky Companion",
    description: "Your companion app for deeper Bluesky insights",
    ogImage: "https://shadowsky.io/og-image.png",
    canonicalUrl,
    cardType: "summary",
    authorName: "ShadowSky",
    authorHandle: "shadowsky"
  });
}
var handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const userAgent = request.headers["user-agent"]?.[0]?.value;
  if (!isCrawler(userAgent)) {
    return request;
  }
  const threadMatch = uri.match(/^\/thread\/([^/]+)\/([^/]+)$/);
  if (threadMatch) {
    const [, handle, postId] = threadMatch;
    const post = await fetchPostThread(handle, postId);
    const canonicalUrl = `https://shadowsky.io${uri}`;
    const html = post ? generateThreadOgHtml(post, handle, postId) : generateFallbackHtml(canonicalUrl);
    return {
      status: "200",
      statusDescription: "OK",
      headers: {
        "content-type": [{ key: "Content-Type", value: "text/html; charset=utf-8" }],
        "cache-control": [{ key: "Cache-Control", value: "public, max-age=3600" }]
      },
      body: html
    };
  }
  const profileMatch = uri.match(/^\/profile\/([^/]+)$/);
  if (profileMatch) {
    const [, handle] = profileMatch;
    const profile = await fetchProfile(handle);
    const canonicalUrl = `https://shadowsky.io${uri}`;
    const html = profile ? generateProfileOgHtml(profile, handle) : generateFallbackHtml(canonicalUrl);
    return {
      status: "200",
      statusDescription: "OK",
      headers: {
        "content-type": [{ key: "Content-Type", value: "text/html; charset=utf-8" }],
        "cache-control": [{ key: "Cache-Control", value: "public, max-age=3600" }]
      },
      body: html
    };
  }
  return request;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
