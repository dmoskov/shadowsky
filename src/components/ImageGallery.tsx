import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { ProgressiveImage } from "./ui/ProgressiveImage";

interface ImageGalleryProps {
  images: Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
  }>;
  initialIndex?: number;
  onClose: () => void;
}

export function ImageGallery({
  images,
  initialIndex = 0,
  onClose,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [currentIndex, images.length, onClose, handleNext, handlePrevious]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-gray-300"
        aria-label="Close gallery"
      >
        <X size={24} />
      </button>

      {/* Image counter */}
      <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-gray-300"
          aria-label="Previous image"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-gray-300"
          aria-label="Next image"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Main image */}
      <div className="relative max-h-[90vh] max-w-[90vw]">
        <ProgressiveImage
          src={images[currentIndex].fullsize}
          placeholderSrc={images[currentIndex].thumb}
          alt={images[currentIndex].alt || `Image ${currentIndex + 1}`}
          className="max-h-[90vh] max-w-full"
          onLoad={() => {
            /* Image loaded */
          }}
        />

        {/* Alt text display */}
        {images[currentIndex].alt && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-3 text-sm text-white">
            {images[currentIndex].alt}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-lg bg-black/50 p-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
              }}
              className={`h-12 w-12 overflow-hidden rounded transition-all ${
                index === currentIndex
                  ? "ring-2 ring-white"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={image.thumb}
                alt={`Thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
