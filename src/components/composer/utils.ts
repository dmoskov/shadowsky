/**
 * Utility functions for the Composer component
 * These are pure functions extracted from Composer.tsx
 */

import {
  MAX_POST_LENGTH,
  NUMBERING_FORMATS,
  type NumberingFormatType,
  type NumberingPosition,
} from "./types";

/**
 * Get video duration from a file
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Apply numbering format to posts
 */
export function applyNumbering(
  posts: string[],
  order: number[] | undefined,
  numberingFormat: NumberingFormatType,
  numberingPosition: NumberingPosition,
): string[] {
  if (numberingFormat === "none" || posts.length === 1) return posts;

  const format = NUMBERING_FORMATS.find((f) => f.id === numberingFormat);
  if (!format) return posts;

  // If we have a custom order, apply it
  const orderedPosts =
    order && order.length === posts.length ? order.map((i) => posts[i]) : posts;

  return orderedPosts.map((post, index) => {
    const numbering = format.format(index + 1, orderedPosts.length);
    return numberingPosition === "beginning"
      ? `${numbering} ${post}`
      : `${post} ${numbering}`;
  });
}

/**
 * Split text into posts based on manual markers and max length
 */
export function splitTextIntoPosts(
  text: string,
  numberingFormat: NumberingFormatType,
): string[] {
  if (!text.trim()) {
    return [];
  }

  const manualSplitMarker = "\n---\n";

  if (text.includes(manualSplitMarker)) {
    // Split by manual markers first
    const manualSplits = text
      .split(manualSplitMarker)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const finalPosts: string[] = [];

    // Then check each manually split section for length
    for (const section of manualSplits) {
      if (section.length <= MAX_POST_LENGTH) {
        finalPosts.push(section);
      } else {
        // If a manual section is too long, auto-split it
        const splitSection = splitLongText(
          section,
          finalPosts.length,
          numberingFormat,
        );
        finalPosts.push(...splitSection);
      }
    }

    return finalPosts;
  } else {
    // No manual splits, use auto-split logic
    return autoSplitText(text, numberingFormat);
  }
}

/**
 * Auto-split text into posts by word boundaries
 */
function autoSplitText(
  text: string,
  numberingFormat: NumberingFormatType,
): string[] {
  const words = text.split(" ");
  const splitPosts: string[] = [];
  let currentPost = "";

  for (const word of words) {
    const testPost = currentPost ? `${currentPost} ${word}` : word;

    // Account for numbering in length calculation
    const format = NUMBERING_FORMATS.find((f) => f.id === numberingFormat);
    const numberingLength =
      format && numberingFormat !== "none"
        ? format.format(splitPosts.length + 1, 999).length + 2
        : 0; // +2 for space and safety margin

    if (testPost.length + numberingLength <= MAX_POST_LENGTH) {
      currentPost = testPost;
    } else {
      if (currentPost) {
        splitPosts.push(currentPost);
      }
      currentPost = word;
    }
  }

  if (currentPost) {
    splitPosts.push(currentPost);
  }

  return splitPosts;
}

/**
 * Split a long section of text while preserving post count offset
 */
function splitLongText(
  section: string,
  existingPostCount: number,
  numberingFormat: NumberingFormatType,
): string[] {
  const words = section.split(" ");
  const finalPosts: string[] = [];
  let currentPost = "";

  for (const word of words) {
    const testPost = currentPost ? `${currentPost} ${word}` : word;

    // Account for numbering in length calculation
    const format = NUMBERING_FORMATS.find((f) => f.id === numberingFormat);
    const numberingLength =
      format && numberingFormat !== "none"
        ? format.format(existingPostCount + finalPosts.length + 1, 999).length +
          2
        : 0;

    if (testPost.length + numberingLength <= MAX_POST_LENGTH) {
      currentPost = testPost;
    } else {
      if (currentPost) {
        finalPosts.push(currentPost);
      }
      currentPost = word;
    }
  }

  if (currentPost) {
    finalPosts.push(currentPost);
  }

  return finalPosts;
}

/**
 * Generate a unique ID for media items
 */
export function generateMediaId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Calculate the effective character count with numbering
 */
export function getEffectiveLength(
  text: string,
  postIndex: number,
  totalPosts: number,
  numberingFormat: NumberingFormatType,
): number {
  if (numberingFormat === "none" || totalPosts <= 1) {
    return text.length;
  }

  const format = NUMBERING_FORMATS.find((f) => f.id === numberingFormat);
  if (!format) {
    return text.length;
  }

  const numbering = format.format(postIndex + 1, totalPosts);
  return text.length + numbering.length + 1; // +1 for space
}

/**
 * Check if a file is a supported video format
 */
export function isSupportedVideoFormat(
  file: File,
  supportedFormats: string[],
): boolean {
  const isVideoMime = file.type.startsWith("video/");
  const hasVideoExtension = supportedFormats.some((format) =>
    file.name.toLowerCase().endsWith(format),
  );
  return isVideoMime || hasVideoExtension;
}

/**
 * Extract URLs from text for link preview detection
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

/**
 * Extract existing hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[a-zA-Z0-9]+/g;
  const matches = text.match(hashtagRegex) || [];
  return matches.map((tag) => tag.slice(1)); // Remove the # prefix
}

/**
 * Calculate remaining characters for a post
 */
export function getRemainingCharacters(
  text: string,
  postIndex: number,
  totalPosts: number,
  numberingFormat: NumberingFormatType,
): number {
  const effectiveLength = getEffectiveLength(
    text,
    postIndex,
    totalPosts,
    numberingFormat,
  );
  return MAX_POST_LENGTH - effectiveLength;
}

/**
 * Check if alt text is missing on any image
 */
export function hasMissingAltText(
  media: { type: "image" | "video"; alt: string }[],
): boolean {
  return media.some((m) => m.type === "image" && !m.alt);
}
