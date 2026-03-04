/**
 * EmbedRenderer Component
 *
 * Handles rendering of all embed types in posts:
 * - Images (with gallery support and alt text generation)
 * - Videos
 * - External links
 * - Quote posts
 * - Record with media
 *
 * Extracted from ThreadViewer for better maintainability and reusability.
 */

import { List, Rss, Shield, Sparkles, Users } from "lucide-react";
import React, { useCallback, useState } from "react";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { createLogger } from "../utils/logger";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
import { VideoPlayer } from "./VideoPlayer";

const logger = createLogger("EmbedRenderer");

// Lazy load Anthropic service for alt text generation
async function loadAnthropicService() {
  return await import("../services/anthropic");
}

export interface EmbedRendererProps {
  embed: any;
  postUri?: string;
  onImageClick?: (
    images: Array<{ thumb: string; fullsize: string; alt?: string }>,
    index: number,
  ) => void;
}

/**
 * EmbedRenderer - Renders different types of embeds for posts
 */
export const EmbedRenderer: React.FC<EmbedRendererProps> = ({
  embed,
  postUri,
  onImageClick,
}) => {
  const navigate = useViewTransitionNavigate();
  const [generatedAltTexts, setGeneratedAltTexts] = useState<
    Record<string, Record<number, string>>
  >({});
  const [generatingAltText, setGeneratingAltText] = useState<
    Record<string, Record<number, boolean>>
  >({});
  const [showAltText, setShowAltText] = useState<
    Record<string, Record<number, boolean>>
  >({});

  const handleGenerateAltText = useCallback(
    async (imageUrl: string, postKey: string, index: number) => {
      setGeneratingAltText((prev) => ({
        ...prev,
        [postKey]: { ...prev[postKey], [index]: true },
      }));
      try {
        const anthropicService = await loadAnthropicService();
        const altText = await anthropicService.generateAltText(imageUrl);

        setGeneratedAltTexts((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: altText },
        }));
        setShowAltText((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: true },
        }));
      } catch (error) {
        logger.error("Error generating alt text:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to generate alt text",
        );
      } finally {
        setGeneratingAltText((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: false },
        }));
      }
    },
    [],
  );

  // Recursive rendering for nested embeds
  const renderEmbedInternal = useCallback(
    (embedData: any, uri?: string): JSX.Element | null => {
      if (!embedData) return null;

      // Image embeds
      if (embedData.$type === "app.bsky.embed.images#view") {
        const handleImageClickInternal = (
          e: React.MouseEvent,
          index: number,
        ) => {
          e.stopPropagation();
          const images = embedData.images.map((img: any) => ({
            thumb: proxifyBskyImage(img.thumb),
            fullsize: proxifyBskyImage(img.fullsize),
            alt: img.alt,
          }));
          onImageClick?.(images, index);
        };

        return (
          <div
            className={`mt-2 grid gap-1 ${embedData.images.length === 1 ? "max-w-2xl grid-cols-1" : embedData.images.length === 2 ? "max-w-3xl grid-cols-2" : embedData.images.length === 3 ? "max-w-3xl grid-cols-2" : "max-w-3xl grid-cols-2"}`}
          >
            {embedData.images.map((img: any, idx: number) => {
              const postKey = uri || "";
              const currentAltText =
                generatedAltTexts[postKey]?.[idx] || img.alt;
              const hasAltText = currentAltText && currentAltText.length > 0;
              const isGenerating = generatingAltText[postKey]?.[idx];
              const shouldShowAlt = showAltText[postKey]?.[idx];

              // Calculate dimensions from aspectRatio if available
              const aspectRatio = img.aspectRatio
                ? img.aspectRatio.width / img.aspectRatio.height
                : undefined;

              return (
                <div
                  key={`embed-img-${img.thumb}-${idx}`}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-90 ${
                    embedData.images.length === 3 && idx === 0
                      ? "col-span-2"
                      : ""
                  }`}
                  onClick={(e) => handleImageClickInternal(e, idx)}
                  style={{
                    aspectRatio: aspectRatio || undefined,
                  }}
                >
                  <img
                    src={proxifyBskyImage(img.thumb)}
                    alt={currentAltText || ""}
                    className="mx-auto h-auto w-full rounded-lg object-contain"
                    style={{
                      maxHeight:
                        embedData.images.length === 1 ? "400px" : "300px",
                      maxWidth:
                        embedData.images.length === 1 ? "600px" : "100%",
                      backgroundColor: "var(--asph-bg-tertiary)",
                    }}
                    width={img.aspectRatio?.width}
                    height={img.aspectRatio?.height}
                  />

                  {/* Alt text overlay */}
                  {hasAltText && shouldShowAlt && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black bg-opacity-70 p-2 text-xs text-white">
                      {currentAltText}
                    </div>
                  )}

                  {/* Alt text generation button */}
                  {uri && (
                    <button
                      className="absolute right-2 top-2 z-10 rounded-full bg-black bg-opacity-60 p-1.5 text-white opacity-0 transition-all hover:bg-opacity-80 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasAltText && !generatedAltTexts[postKey]?.[idx]) {
                          // Toggle showing existing alt text
                          setShowAltText((prev) => ({
                            ...prev,
                            [postKey]: {
                              ...prev[postKey],
                              [idx]: !shouldShowAlt,
                            },
                          }));
                        } else if (!hasAltText) {
                          // Generate new alt text
                          handleGenerateAltText(
                            proxifyBskyImage(img.fullsize) ||
                              proxifyBskyImage(img.thumb) ||
                              "",
                            uri,
                            idx,
                          );
                        }
                      }}
                      disabled={isGenerating}
                      title={
                        hasAltText ? "Toggle alt text" : "Generate alt text"
                      }
                    >
                      {isGenerating ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      // External link embeds
      if (embedData.$type === "app.bsky.embed.external#view") {
        return (
          <div
            className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10"
            style={{ borderColor: "var(--asph-border-primary)" }}
            onClick={(e) => {
              e.stopPropagation();
              if (embedData.external.uri) {
                window.open(
                  embedData.external.uri,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            }}
          >
            {embedData.external.thumb && (
              <img
                src={proxifyBskyImage(embedData.external.thumb)}
                alt=""
                className="mb-1 h-auto w-full rounded object-contain"
                style={{
                  maxHeight: "200px",
                  backgroundColor: "var(--asph-bg-tertiary)",
                }}
              />
            )}
            <div
              className="font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              {embedData.external.title}
            </div>
            <div
              className="mt-0.5 opacity-80"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {embedData.external.description}
            </div>
          </div>
        );
      }

      // Video embeds
      if (embedData.$type === "app.bsky.embed.video#view") {
        return (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <VideoPlayer
              src={proxifyBskyVideo(embedData.playlist) || ""}
              thumbnail={
                embedData.thumbnail
                  ? proxifyBskyVideo(embedData.thumbnail)
                  : undefined
              }
              aspectRatio={embedData.aspectRatio}
              alt={embedData.alt}
            />
          </div>
        );
      }

      // Record embeds (quoted posts, starter packs, feeds, lists, labelers)
      if (embedData.$type === "app.bsky.embed.record#view") {
        const recordData = embedData.record;

        if (
          recordData?.$type === "app.bsky.embed.record#viewNotFound" ||
          recordData?.$type === "app.bsky.embed.record#viewDetached"
        ) {
          return (
            <div
              className="mt-2 rounded-lg border p-2 text-xs italic"
              style={{
                borderColor: "var(--asph-border-primary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              Post not found or deleted
            </div>
          );
        }

        if (recordData?.$type === "app.bsky.embed.record#viewBlocked") {
          return (
            <div
              className="mt-2 rounded-lg border p-2 text-xs italic"
              style={{
                borderColor: "var(--asph-border-primary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              Post from blocked user
            </div>
          );
        }

        // Starter pack embed
        if (recordData?.$type === "app.bsky.graph.defs#starterPackViewBasic") {
          const starterPack = recordData as any;
          const packRecord = starterPack.record as any;
          const packName = packRecord?.name || "Starter Pack";
          return (
            <div
              className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
              style={{ borderColor: "var(--asph-border-primary)" }}
              onClick={(e) => {
                e.stopPropagation();
                if (starterPack.creator?.handle) {
                  const rkey = starterPack.uri?.split("/").pop();
                  if (rkey) {
                    window.open(
                      `https://bsky.app/starter-pack/${starterPack.creator.handle}/${rkey}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }
              }}
            >
              <div className="mb-1 flex items-center gap-1">
                <Users
                  size={12}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {packName}
                </span>
              </div>
              <div style={{ color: "var(--asph-text-secondary)" }}>
                {starterPack.creator?.handle && (
                  <span>by @{starterPack.creator.handle}</span>
                )}
                {starterPack.listItemCount != null && (
                  <span> · {starterPack.listItemCount} members</span>
                )}
              </div>
            </div>
          );
        }

        // Feed generator embed
        if (recordData?.$type === "app.bsky.feed.defs#generatorView") {
          const feedGen = recordData as any;
          return (
            <div
              className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
              style={{ borderColor: "var(--asph-border-primary)" }}
              onClick={(e) => {
                e.stopPropagation();
                if (feedGen.creator?.handle) {
                  const rkey = feedGen.uri?.split("/").pop();
                  if (rkey) {
                    window.open(
                      `https://bsky.app/profile/${feedGen.creator.handle}/feed/${rkey}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }
              }}
            >
              <div className="mb-1 flex items-center gap-1">
                <Rss
                  size={12}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {feedGen.displayName}
                </span>
              </div>
              {feedGen.description && (
                <div
                  className="line-clamp-2"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {feedGen.description}
                </div>
              )}
            </div>
          );
        }

        // List embed
        if (recordData?.$type === "app.bsky.graph.defs#listView") {
          const listView = recordData as any;
          return (
            <div
              className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
              style={{ borderColor: "var(--asph-border-primary)" }}
              onClick={(e) => {
                e.stopPropagation();
                if (listView.creator?.handle) {
                  const rkey = listView.uri?.split("/").pop();
                  if (rkey) {
                    window.open(
                      `https://bsky.app/profile/${listView.creator.handle}/lists/${rkey}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }
              }}
            >
              <div className="mb-1 flex items-center gap-1">
                <List
                  size={12}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {listView.name}
                </span>
              </div>
              {listView.description && (
                <div
                  className="line-clamp-2"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {listView.description}
                </div>
              )}
            </div>
          );
        }

        // Labeler embed
        if (recordData?.$type === "app.bsky.labeler.defs#labelerView") {
          const labeler = recordData as any;
          return (
            <div
              className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
              style={{ borderColor: "var(--asph-border-primary)" }}
              onClick={(e) => {
                e.stopPropagation();
                if (labeler.creator?.handle) {
                  window.open(
                    `https://bsky.app/profile/${labeler.creator.handle}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
            >
              <div className="mb-1 flex items-center gap-1">
                <Shield
                  size={12}
                  style={{ color: "var(--asph-text-secondary)" }}
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {labeler.creator?.displayName || labeler.creator?.handle}
                </span>
              </div>
              <div style={{ color: "var(--asph-text-secondary)" }}>
                Labeler service
              </div>
            </div>
          );
        }

        // Quoted post (app.bsky.embed.record#viewRecord)
        if (recordData?.$type === "app.bsky.embed.record#viewRecord") {
          const quotedPost = recordData;
          return (
            <div
              className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
              style={{ borderColor: "var(--asph-border-primary)" }}
              onClick={(e) => {
                e.stopPropagation();
                if (quotedPost.uri && quotedPost.author?.handle) {
                  const quotedPostId = quotedPost.uri.split("/").pop();
                  navigate(
                    `/thread/${quotedPost.author.handle}/${quotedPostId}`,
                  );
                }
              }}
            >
              <div className="mb-1 flex items-center gap-1">
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <img
                      src={
                        proxifyBskyImage(quotedPost.author.avatar) ||
                        "/default-avatar.svg"
                      }
                      alt={quotedPost.author?.handle || "unknown"}
                      className="h-4 w-4 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                    />
                  </ProfileHoverCard>
                ) : (
                  <img
                    src={
                      proxifyBskyImage(quotedPost.author?.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt={quotedPost.author?.handle || "unknown"}
                    className="h-4 w-4 rounded-full"
                  />
                )}
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <span
                      className="cursor-pointer font-semibold hover:underline"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {quotedPost.author?.displayName ||
                        quotedPost.author?.handle ||
                        "Unknown"}
                    </span>
                  </ProfileHoverCard>
                ) : (
                  <span
                    className="font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {quotedPost.author?.displayName ||
                      quotedPost.author?.handle ||
                      "Unknown"}
                  </span>
                )}
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <span
                      className="cursor-pointer hover:underline"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      @{quotedPost.author?.handle || "unknown"}
                    </span>
                  </ProfileHoverCard>
                ) : (
                  <span style={{ color: "var(--asph-text-secondary)" }}>
                    @{quotedPost.author?.handle || "unknown"}
                  </span>
                )}
              </div>
              <div style={{ color: "var(--asph-text-primary)" }}>
                <RichText
                  text={quotedPost.value?.text || ""}
                  facets={quotedPost.value?.facets}
                />
              </div>
            </div>
          );
        }
      }

      // Record with media embeds (combines record and media)
      if (embedData.$type === "app.bsky.embed.recordWithMedia#view") {
        return (
          <div className="mt-2">
            {embedData.media && renderEmbedInternal(embedData.media, uri)}
            {embedData.record && renderEmbedInternal(embedData.record, uri)}
          </div>
        );
      }

      return null;
    },
    [
      generatedAltTexts,
      generatingAltText,
      showAltText,
      handleGenerateAltText,
      onImageClick,
      navigate,
    ],
  );

  return renderEmbedInternal(embed, postUri);
};
