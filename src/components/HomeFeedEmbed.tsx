import { Heart, List, MessageCircle, Rss, Shield, Users } from "lucide-react";
import React, { Suspense } from "react";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { ImageGrid } from "./ImageGrid";
import { Spinner } from "./ui/LoadingState";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
import type { Embed, EmbedImage } from "./Home.types";

const VideoPlayer = lazyWithRetry(() =>
  import("./VideoPlayer").then((m) => ({ default: m.VideoPlayer })),
);

export interface GalleryImage {
  thumb: string;
  fullsize: string;
  alt?: string;
}

interface FeedEmbedProps {
  embed: Embed | null | undefined;
  /** Open the lightbox gallery at the given index. */
  onOpenGallery: (images: GalleryImage[], index: number) => void;
  /** Open a quoted post in the thread modal. */
  onOpenQuotedPost: (uri: string) => void;
}

/**
 * Renders a post embed in the home feed: images, external links/GIFs, video,
 * quoted posts, starter packs, feed generators, lists, and labelers.
 * Extracted from Home.tsx (was the ~640-line renderEmbed callback).
 */
export const FeedEmbed: React.FC<FeedEmbedProps> = ({
  embed,
  onOpenGallery,
  onOpenQuotedPost,
}) => {
  if (!embed) return null;

  if (embed.$type === "app.bsky.embed.images#view") {
    return (
      <ImageGrid
        images={(embed.images || []).map((img: EmbedImage) => ({
          thumb: img.thumb,
          fullsize: img.fullsize || img.thumb,
          alt: img.alt,
        }))}
        onImageClick={(index) => {
          const images = (embed.images || []).map((img: EmbedImage) => ({
            thumb: proxifyBskyImage(img.thumb) || "",
            fullsize: proxifyBskyImage(img.fullsize || img.thumb) || "",
            alt: img.alt || "",
          }));
          onOpenGallery(images, index);
        }}
      />
    );
  }

  if (embed.$type === "app.bsky.embed.external#view") {
    const external = embed.external;
    if (!external) return null;

    const isGif =
      external.uri?.toLowerCase().includes(".gif") ||
      external.uri?.includes("tenor.com") ||
      external.uri?.includes("giphy.com") ||
      external.uri?.includes("t.gifs.bsky.app");

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (external.uri) {
        window.open(external.uri, "_blank", "noopener,noreferrer");
      }
    };

    if (isGif) {
      return (
        <div
          className="relative mt-2 cursor-pointer overflow-hidden rounded-lg"
          onClick={handleClick}
        >
          <img
            src={external.uri}
            alt={external.title || "GIF"}
            className="w-full object-contain"
            style={{ maxHeight: "400px" }}
            loading="lazy"
          />
          <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
            GIF
          </div>
        </div>
      );
    }

    return (
      <div
        className="mt-2 cursor-pointer rounded-lg border p-2.5 transition-opacity hover:opacity-90"
        style={{ borderColor: "var(--asph-border-primary)" }}
        onClick={handleClick}
      >
        {external.thumb && (
          <img
            src={proxifyBskyImage(external.thumb)}
            alt=""
            className="mb-2 h-auto w-full rounded object-cover"
            style={{
              maxHeight: "200px",
              backgroundColor: "var(--asph-bg-tertiary)",
            }}
          />
        )}
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {external.title}
        </div>
        <div
          className="mt-1 text-xs"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {external.description}
        </div>
      </div>
    );
  }

  if (embed.$type === "app.bsky.embed.video#view") {
    return (
      <div
        className="mt-2 overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center bg-asph-bg-tertiary"
              style={{
                aspectRatio: embed.aspectRatio
                  ? `${embed.aspectRatio.width}/${embed.aspectRatio.height}`
                  : "16/9",
              }}
            >
              <Spinner size="md" aria-label="Loading video" />
            </div>
          }
        >
          <VideoPlayer
            src={proxifyBskyVideo(embed.playlist) || ""}
            thumbnail={
              embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined
            }
            aspectRatio={embed.aspectRatio}
            alt={embed.alt}
          />
        </Suspense>
      </div>
    );
  }

  // Handle record embeds (quoted posts, starter packs, feeds, lists, labelers)
  if (embed.$type === "app.bsky.embed.record#view") {
    const recordData = embed.record;

    // Handle deleted, blocked, or detached
    if (
      recordData?.$type === "app.bsky.embed.record#viewNotFound" ||
      recordData?.$type === "app.bsky.embed.record#viewDetached"
    ) {
      return (
        <div
          className="mt-2 overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <MessageCircle size={12} />
            <span>Quoted post</span>
          </div>
          <div className="p-3">
            <div
              className="text-sm italic"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Post not found or deleted
            </div>
          </div>
        </div>
      );
    }
    if (recordData?.$type === "app.bsky.embed.record#viewBlocked") {
      return (
        <div
          className="mt-2 overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <MessageCircle size={12} />
            <span>Quoted post</span>
          </div>
          <div className="p-3">
            <div
              className="text-sm italic"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Post from blocked user
            </div>
          </div>
        </div>
      );
    }

    // Starter pack embed
    if (recordData?.$type === "app.bsky.graph.defs#starterPackViewBasic") {
      const starterPack = recordData as any;
      const packRecord = starterPack.record as any;
      const packName = packRecord?.name || "Starter Pack";
      const packDescription = packRecord?.description || "";
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
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
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <Users size={12} />
            <span>Starter Pack</span>
          </div>
          <div className="p-3">
            <div className="mb-1 flex items-center gap-2">
              {starterPack.creator?.avatar && (
                <img
                  src={
                    proxifyBskyImage(starterPack.creator.avatar) ||
                    "/default-avatar.svg"
                  }
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
              )}
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {packName}
              </span>
            </div>
            {packDescription && (
              <p
                className="mt-1 line-clamp-2 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {packDescription}
              </p>
            )}
            <div
              className="mt-2 flex items-center gap-3 text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              {starterPack.creator?.handle && (
                <span>by @{starterPack.creator.handle}</span>
              )}
              {starterPack.listItemCount != null && (
                <span>{starterPack.listItemCount} members</span>
              )}
              {starterPack.joinedAllTimeCount != null && (
                <span>{starterPack.joinedAllTimeCount} joined</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Feed generator embed
    if (recordData?.$type === "app.bsky.feed.defs#generatorView") {
      const feedGen = recordData as any;
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
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
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <Rss size={12} />
            <span>Feed</span>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2">
              {feedGen.avatar && (
                <img
                  src={proxifyBskyImage(feedGen.avatar)}
                  alt=""
                  className="h-8 w-8 rounded-lg"
                />
              )}
              <div className="min-w-0 flex-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {feedGen.displayName}
                </span>
                {feedGen.creator?.handle && (
                  <div
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    by @{feedGen.creator.handle}
                  </div>
                )}
              </div>
            </div>
            {feedGen.description && (
              <p
                className="mt-2 line-clamp-2 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {feedGen.description}
              </p>
            )}
            {feedGen.likeCount != null && feedGen.likeCount > 0 && (
              <div
                className="mt-2 flex items-center gap-1 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <Heart size={11} />
                <span>{feedGen.likeCount}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // List embed
    if (recordData?.$type === "app.bsky.graph.defs#listView") {
      const listView = recordData as any;
      const purposeLabel =
        listView.purpose === "app.bsky.graph.defs#modlist"
          ? "Moderation List"
          : listView.purpose === "app.bsky.graph.defs#curatelist"
            ? "User List"
            : "List";
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
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
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <List size={12} />
            <span>{purposeLabel}</span>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2">
              {listView.avatar && (
                <img
                  src={proxifyBskyImage(listView.avatar)}
                  alt=""
                  className="h-8 w-8 rounded-lg"
                />
              )}
              <div className="min-w-0 flex-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {listView.name}
                </span>
                {listView.creator?.handle && (
                  <div
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    by @{listView.creator.handle}
                  </div>
                )}
              </div>
            </div>
            {listView.description && (
              <p
                className="mt-2 line-clamp-2 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {listView.description}
              </p>
            )}
            {listView.listItemCount != null && (
              <div
                className="mt-2 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                {listView.listItemCount} members
              </div>
            )}
          </div>
        </div>
      );
    }

    // Labeler service embed
    if (recordData?.$type === "app.bsky.labeler.defs#labelerView") {
      const labeler = recordData as any;
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
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
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <Shield size={12} />
            <span>Labeler</span>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2">
              {labeler.creator?.avatar && (
                <img
                  src={
                    proxifyBskyImage(labeler.creator.avatar) ||
                    "/default-avatar.svg"
                  }
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <div className="min-w-0 flex-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {labeler.creator?.displayName || labeler.creator?.handle}
                </span>
                {labeler.creator?.handle && (
                  <div
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    @{labeler.creator.handle}
                  </div>
                )}
              </div>
            </div>
            {labeler.likeCount != null && labeler.likeCount > 0 && (
              <div
                className="mt-2 flex items-center gap-1 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <Heart size={11} />
                <span>{labeler.likeCount}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Normal quoted post
    if (recordData?.$type === "app.bsky.embed.record#viewRecord") {
      const quotedPost = recordData;
      return (
        <div
          className="mt-2 overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          {/* Quote post header */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: `1px solid var(--asph-border-primary)`,
              color: "var(--asph-text-secondary)",
            }}
          >
            <MessageCircle size={12} />
            <span>Quoted post</span>
          </div>

          {/* Quote post content */}
          <div
            className="cursor-pointer p-3"
            data-clickable="quote"
            onClick={(e) => {
              e.stopPropagation();
              if (quotedPost.uri && quotedPost.author) {
                onOpenQuotedPost(quotedPost.uri);
              }
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              {quotedPost.author?.handle && (
                <ProfileHoverCard handle={quotedPost.author.handle}>
                  <img
                    src={
                      proxifyBskyImage(quotedPost.author.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt={quotedPost.author?.handle || "unknown"}
                    className="h-5 w-5 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                  />
                </ProfileHoverCard>
              )}
              <div className="flex items-center gap-1 text-sm">
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <span
                      className="cursor-pointer font-semibold hover:underline"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {quotedPost.author?.displayName ||
                        quotedPost.author?.handle}
                    </span>
                  </ProfileHoverCard>
                ) : (
                  <span
                    className="font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    Unknown
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
            </div>
            <div
              className="text-sm"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <RichText
                text={quotedPost.value?.text || ""}
                facets={
                  quotedPost.value?.facets as Parameters<
                    typeof RichText
                  >[0]["facets"]
                }
              />
            </div>
            {quotedPost.embeds?.[0] && (
              <FeedEmbed
                embed={quotedPost.embeds[0]}
                onOpenGallery={onOpenGallery}
                onOpenQuotedPost={onOpenQuotedPost}
              />
            )}
          </div>
        </div>
      );
    }
  }

  // Handle record with media (quote post + media)
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    return (
      <div className="mt-3">
        {embed.media && (
          <FeedEmbed
            embed={embed.media}
            onOpenGallery={onOpenGallery}
            onOpenQuotedPost={onOpenQuotedPost}
          />
        )}
        {embed.record && (
          <FeedEmbed
            embed={embed.record}
            onOpenGallery={onOpenGallery}
            onOpenQuotedPost={onOpenQuotedPost}
          />
        )}
      </div>
    );
  }

  return null;
};
