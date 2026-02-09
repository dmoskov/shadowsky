import React, { useState } from "react";
import { proxifyBskyImage } from "../utils/image-proxy";
import { Lightbox } from "./Lightbox";

// Sensitive content labels from Bluesky
const SENSITIVE_LABELS = ["porn", "sexual", "nudity", "graphic-media"];

// Check if content has sensitive labels that should be blurred
const hasSensitiveLabels = (labels?: Array<{ val: string }>): boolean => {
  if (!labels || labels.length === 0) return false;
  return labels.some((label) => SENSITIVE_LABELS.includes(label.val));
};

// Get human-readable warning text for sensitive labels
const getWarningText = (labels?: Array<{ val: string }>): string => {
  if (!labels || labels.length === 0) return "Sensitive Content";
  const labelMap: Record<string, string> = {
    porn: "Adult Content",
    sexual: "Sexual Content",
    nudity: "Nudity",
    "graphic-media": "Graphic Content",
  };
  for (const label of labels) {
    if (labelMap[label.val]) return labelMap[label.val];
  }
  return "Sensitive Content";
};

interface ImageData {
  thumb: string;
  fullsize: string;
  alt?: string;
}

interface ImageGridProps {
  images: ImageData[];
  onImageClick?: (index: number) => void;
  className?: string;
  labels?: Array<{ val: string }>;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onImageClick,
  className = "",
  labels,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showSensitive, setShowSensitive] = useState(false);

  if (!images || images.length === 0) return null;

  // Use simple label-based sensitivity check (blur by default, never completely hide)
  const blurMedia = hasSensitiveLabels(labels);
  const showContent = !blurMedia || showSensitive;

  const handleImageClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (onImageClick) {
      onImageClick(index);
    } else {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const handleShowSensitive = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSensitive(true);
  };

  // Determine grid layout based on image count
  const gridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
        ? "grid-cols-2"
        : images.length === 3
          ? "grid-cols-3"
          : "grid-cols-2";

  return (
    <>
      {/*
        Image grid container with CSS container query support
        Uses aspect-ratio for CLS prevention - reserves space before images load
      */}
      <div
        className={`mt-2 grid gap-1 ${gridClass} ${className} placeholder-container relative`}
        role="group"
        aria-label={`Image gallery with ${images.length} image${images.length > 1 ? "s" : ""}`}
      >
        {images.map((img, idx) => {
          // Special layout for 3 images: first image takes 2/3, others 1/3 each
          const isThreeImageLayout = images.length === 3;
          const colSpan =
            isThreeImageLayout && idx === 0 ? "col-span-2 row-span-2" : "";

          // Calculate aspect ratio for CLS prevention
          // For 3-image layout: first image is square, others are 4:3
          // For other layouts: 4:3 (75% padding = 4:3 ratio)
          const aspectRatioValue = isThreeImageLayout && idx === 0 ? 1 : 4 / 3;

          return (
            <div
              key={`image-grid-${img.thumb}-${idx}`}
              className={`media-placeholder-wrapper relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-95 ${colSpan}`}
              onClick={(e) => handleImageClick(e, idx)}
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                // Use CSS aspect-ratio for CLS prevention - reserves exact space before image loads
                aspectRatio: aspectRatioValue,
                // Maximum height constraints
                maxHeight: isThreeImageLayout && idx === 0 ? "500px" : "350px",
              }}
              data-aspect-ratio="true"
            >
              {/* Loading state placeholder - uses CSS animation from placeholder-system.css */}
              <div
                className="placeholder-layer placeholder-animated absolute inset-0 bg-bsky-bg-tertiary"
                aria-hidden="true"
              />

              {/* Image with lazy loading */}
              <img
                src={proxifyBskyImage(img.thumb)}
                alt={img.alt || "Image attachment"}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                loading="lazy"
                decoding="async"
                onLoad={(e) => {
                  const imgEl = e.target as HTMLImageElement;
                  imgEl.style.opacity = "1";
                  // Mark parent as loaded for placeholder fade-out
                  const parent = imgEl.closest(".media-placeholder-wrapper");
                  if (parent) {
                    parent.setAttribute("data-loaded", "true");
                  }
                }}
                style={{
                  opacity: 0,
                  filter: blurMedia && !showContent ? "blur(20px)" : "none",
                  position: "relative",
                  zIndex: 1,
                }}
              />

              {/* Alt text indicator badge */}
              {img.alt && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-xs text-white opacity-0 transition-opacity hover:opacity-100"
                  style={{ zIndex: 2 }}
                  aria-label="Alt text available"
                  title={`Alt text: ${img.alt}`}
                >
                  ALT
                </div>
              )}
            </div>
          );
        })}
        {blurMedia && !showContent && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleShowSensitive}
              className="rounded-lg px-6 py-3 text-sm font-medium shadow-lg transition-colors"
              style={{
                backgroundColor: "var(--bsky-bg-primary)",
                color: "var(--bsky-text-primary)",
                border: "2px solid var(--bsky-border-primary)",
              }}
            >
              {getWarningText(labels)} - Click to Show
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={images.map((img) => ({
          src: proxifyBskyImage(img.fullsize) || "",
          alt: img.alt || "",
        }))}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </>
  );
};
