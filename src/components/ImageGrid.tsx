import React, { useState } from "react";
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
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onImageClick,
  className = "",
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const handleImageClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (onImageClick) {
      onImageClick(index);
    } else {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
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
      <div className={`mt-2 grid gap-1 ${gridClass} ${className}`}>
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
                  style={{ opacity: 0 }}
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
