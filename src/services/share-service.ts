/**
 * Share Service
 *
 * Provides native share sheet integration using Web Share API.
 * Falls back to clipboard copy when Web Share API is not available.
 */

import { logger } from "../utils/logger";

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export interface ShareResult {
  success: boolean;
  method: "native" | "clipboard" | "failed";
  error?: string;
}

/**
 * Check if Web Share API is supported
 */
export function isWebShareSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

/**
 * Check if sharing files is supported
 */
export function isFileShareSupported(): boolean {
  return (
    isWebShareSupported() &&
    typeof navigator !== "undefined" &&
    !!navigator.canShare
  );
}

/**
 * Check if specific files can be shared
 */
export function canShareFiles(files: File[]): boolean {
  if (!isFileShareSupported()) return false;
  return navigator.canShare({ files });
}

/**
 * Share content using native share sheet or fallback to clipboard
 */
export async function share(data: ShareData): Promise<ShareResult> {
  // Try native Web Share API first
  if (isWebShareSupported()) {
    try {
      // Check if we can share files
      if (data.files && data.files.length > 0) {
        if (!canShareFiles(data.files)) {
          // Remove files and try sharing without them
          const { files: _files, ...dataWithoutFiles } = data;
          await navigator.share(dataWithoutFiles);
          logger.log(
            "[ShareService] Shared without files (files not supported)",
          );
          return { success: true, method: "native" };
        }
      }

      await navigator.share(data);
      logger.log("[ShareService] Native share successful");
      return { success: true, method: "native" };
    } catch (error) {
      // User cancelled or share failed
      if (error instanceof Error && error.name === "AbortError") {
        logger.log("[ShareService] User cancelled share");
        return { success: false, method: "native", error: "Share cancelled" };
      }

      // Fall through to clipboard fallback
      logger.log(
        "[ShareService] Native share failed, falling back to clipboard:",
        error,
      );
    }
  }

  // Fallback to clipboard
  const textToCopy = data.url || data.text || data.title || "";
  if (!textToCopy) {
    return { success: false, method: "failed", error: "No content to share" };
  }

  try {
    await navigator.clipboard.writeText(textToCopy);
    logger.log("[ShareService] Copied to clipboard:", textToCopy);
    return { success: true, method: "clipboard" };
  } catch (error) {
    logger.log("[ShareService] Clipboard copy failed:", error);
    return {
      success: false,
      method: "failed",
      error: error instanceof Error ? error.message : "Failed to copy",
    };
  }
}

/**
 * Share a Bluesky post
 */
export async function sharePost(
  postAuthorHandle: string,
  postId: string,
  postText?: string,
): Promise<ShareResult> {
  const url = `${window.location.origin}/thread/${postAuthorHandle}/${postId}`;
  const bskyUrl = `https://bsky.app/profile/${postAuthorHandle}/post/${postId}`;

  const shareData: ShareData = {
    title: `Post by @${postAuthorHandle}`,
    text: postText
      ? `${postText.substring(0, 200)}${postText.length > 200 ? "..." : ""}`
      : undefined,
    url: url,
  };

  const result = await share(shareData);

  // Log which URL format was shared
  logger.log("[ShareService] Shared post:", {
    shadowskyUrl: url,
    bskyUrl: bskyUrl,
    method: result.method,
  });

  return result;
}

/**
 * Share a Bluesky profile
 */
export async function shareProfile(
  handle: string,
  displayName?: string,
  description?: string,
): Promise<ShareResult> {
  const url = `${window.location.origin}/profile/${handle}`;

  const shareData: ShareData = {
    title: displayName || `@${handle}`,
    text: description
      ? `${description.substring(0, 200)}${description.length > 200 ? "..." : ""}`
      : `Check out @${handle} on Bluesky`,
    url: url,
  };

  return share(shareData);
}

/**
 * Share a feed/list
 */
export async function shareFeed(
  feedUri: string,
  feedName: string,
  feedDescription?: string,
): Promise<ShareResult> {
  // Parse feed URI to get creator and feed ID
  // Format: at://did:plc:xxx/app.bsky.feed.generator/feed-name
  const parts = feedUri.split("/");
  const did = parts[2];
  const feedId = parts[parts.length - 1];

  const url = `${window.location.origin}/feed/${did}/${feedId}`;

  const shareData: ShareData = {
    title: feedName,
    text: feedDescription || `Check out the "${feedName}" feed on Bluesky`,
    url: url,
  };

  return share(shareData);
}

/**
 * Share a list
 */
export async function shareList(
  listUri: string,
  listName: string,
  listDescription?: string,
): Promise<ShareResult> {
  // Parse list URI to get creator and list ID
  const parts = listUri.split("/");
  const did = parts[2];
  const listId = parts[parts.length - 1];

  const url = `${window.location.origin}/list/${did}/${listId}`;

  const shareData: ShareData = {
    title: listName,
    text: listDescription || `Check out the "${listName}" list on Bluesky`,
    url: url,
  };

  return share(shareData);
}

/**
 * Share media from a post
 */
export async function shareMedia(
  imageUrl: string,
  altText?: string,
  postAuthorHandle?: string,
): Promise<ShareResult> {
  try {
    // Try to fetch the image and share as file
    if (isFileShareSupported()) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Determine file type from content-type or URL
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const extension = contentType.includes("png") ? "png" : "jpeg";
      const filename = `bluesky-image.${extension}`;

      const file = new File([blob], filename, { type: contentType });

      if (canShareFiles([file])) {
        const shareData: ShareData = {
          title: altText || "Shared from Bluesky",
          text: postAuthorHandle
            ? `Image from @${postAuthorHandle}`
            : undefined,
          files: [file],
        };

        return share(shareData);
      }
    }
  } catch (error) {
    logger.log("[ShareService] Failed to share media as file:", error);
  }

  // Fallback to sharing the URL
  return share({
    title: altText || "Image from Bluesky",
    url: imageUrl,
  });
}

// Types for shared content received via Web Share Target
export interface ReceivedShareData {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Parse shared content from URL parameters (for Web Share Target)
 */
export function parseReceivedShare(
  searchParams: URLSearchParams,
): ReceivedShareData | null {
  const title = searchParams.get("title");
  const text = searchParams.get("text");
  const url = searchParams.get("url");

  if (!title && !text && !url) {
    return null;
  }

  return {
    title: title || undefined,
    text: text || undefined,
    url: url || undefined,
  };
}

/**
 * Extract Bluesky URLs from shared text content
 */
export function extractBskyUrls(text: string): string[] {
  const bskyUrlPattern =
    /https?:\/\/(?:staging\.)?bsky\.app\/profile\/[^\s/]+(?:\/post\/[^\s/]+)?/g;
  return text.match(bskyUrlPattern) || [];
}

/**
 * Compose text for a new post from received shared content
 */
export function composeFromSharedContent(data: ReceivedShareData): string {
  const parts: string[] = [];

  if (data.text) {
    parts.push(data.text);
  }

  if (data.url) {
    // Don't duplicate URL if it's already in the text
    if (!data.text?.includes(data.url)) {
      parts.push(data.url);
    }
  }

  return parts.join("\n\n");
}
