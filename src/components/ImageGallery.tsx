import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";

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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);

  // Reset error state when image changes
  React.useEffect(() => {
    setImageError(false);
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  // Handle touch events for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && images.length > 1) {
      handleNext();
    }
    if (isRightSwipe && images.length > 1) {
      handlePrevious();
    }
  };

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

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.9)", zIndex: 9999 }}
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-2 text-white transition-colors hover:bg-white/10 hover:text-gray-300"
        style={{ zIndex: 10002 }}
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
      <div
        className="flex items-center justify-center"
        style={{
          width: "90vw",
          maxWidth: "90vw",
          height: "90vh",
          maxHeight: "90vh",
          zIndex: 10000,
          position: "relative",
          backgroundColor: "transparent",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {imageError ? (
          <div className="p-4 text-center text-white">
            <p>Failed to load image</p>
            <p className="mt-2 text-sm text-gray-400">
              URL: {images[currentIndex].fullsize || images[currentIndex].thumb}
            </p>
          </div>
        ) : (
          <img
            key={`${currentIndex}-${images[currentIndex].fullsize}`} // Better key for re-render
            src={
              images[currentIndex].fullsize || images[currentIndex].thumb || ""
            }
            alt={images[currentIndex].alt || `Image ${currentIndex + 1}`}
            style={{
              maxHeight: "90vh",
              maxWidth: "90vw",
              height: "auto",
              width: "auto",
              objectFit: "contain",
              display: "block",
              position: "relative",
              zIndex: 10001,
              margin: "0 auto",
              backgroundColor: "transparent",
            }}
            loading="eager"
            onError={() => {
              setImageError(true);
            }}
          />
        )}

        {/* Alt text display */}
        {images[currentIndex].alt && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/70 p-3 text-sm text-white"
            style={{ zIndex: 10002 }}
          >
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
    </div>,
    document.body,
  );
}
