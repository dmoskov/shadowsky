import { AlertTriangle } from "lucide-react";
import React, { useState } from "react";
import { useModerationPreferences } from "../hooks/useModerationPreferences";
import { proxifyBskyImage } from "../utils/image-proxy";
import { Lightbox } from "./Lightbox";

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
  const { shouldBlurMedia, shouldHideMedia, getSensitiveWarningText } =
    useModerationPreferences();

  if (!images || images.length === 0) return null;

  const hideMedia = shouldHideMedia(labels);
  const blurMedia = shouldBlurMedia(labels);
  const isSensitive = hideMedia || blurMedia;
  const showContent = !isSensitive || showSensitive;

  if (hideMedia && !showSensitive) {
    return (
      <div
        className="mt-2 flex items-center justify-center rounded-lg p-8 text-center"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="space-y-3">
          <AlertTriangle
            size={32}
            style={{ color: "var(--bsky-text-secondary)", margin: "0 auto" }}
          />
          <div>
            <div
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {getSensitiveWarningText(labels)}
            </div>
            <div
              className="mt-1 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              This content has been hidden based on your settings
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSensitive(true);
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--bsky-bg-tertiary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            Show Content
          </button>
        </div>
      </div>
    );
  }

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
      <div className={`mt-2 grid gap-1 ${gridClass} ${className} relative`}>
        {images.map((img, idx) => {
          // Special layout for 3 images: first image takes 2/3, others 1/3 each
          const isThreeImageLayout = images.length === 3;
          const colSpan =
            isThreeImageLayout && idx === 0 ? "col-span-2 row-span-2" : "";

          return (
            <div
              key={idx}
              className={`relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-95 ${colSpan}`}
              onClick={(e) => handleImageClick(e, idx)}
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <div
                className="relative w-full"
                style={{
                  paddingBottom:
                    isThreeImageLayout && idx === 0 ? "100%" : "75%",
                }}
              >
                <img
                  src={proxifyBskyImage(img.thumb)}
                  alt={img.alt || ""}
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                  loading="lazy"
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.opacity = "1";
                  }}
                  style={{
                    opacity: 0,
                    filter: blurMedia && !showContent ? "blur(20px)" : "none",
                  }}
                />
                {/* Loading state placeholder with blur effect */}
                <div
                  className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
                  style={{ zIndex: -1, filter: "blur(20px)" }}
                />
              </div>
              {img.alt && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-xs text-white opacity-0 transition-opacity hover:opacity-100">
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
              {getSensitiveWarningText(labels)} - Click to Show
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
