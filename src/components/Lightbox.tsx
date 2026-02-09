import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface LightboxImage {
  src: string;
  alt?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
          }
          break;
        case "ArrowRight":
          if (currentIndex < images.length - 1) {
            onNavigate(currentIndex + 1);
          }
          break;
      }
    },
    [isOpen, currentIndex, images.length, onClose, onNavigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black"
      onClick={handleBackdropClick}
      style={{ zIndex: 999999 }}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed right-4 top-4 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-all hover:bg-white/20"
        style={{ zIndex: 1000000 }}
        aria-label="Close lightbox"
      >
        <X size={24} />
      </button>

      {/* Navigation buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="fixed left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ zIndex: 1000000 }}
            aria-label="Previous image"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            className="fixed right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ zIndex: 1000000 }}
            aria-label="Next image"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      {/* Main image */}
      <div
        className="relative flex items-center justify-center"
        style={{ maxHeight: "90vh", maxWidth: "90vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[currentIndex].src}
          alt={images[currentIndex].alt || ""}
          className="max-h-[90vh] max-w-[90vw] object-contain"
          style={{ position: "relative", zIndex: 1000001 }}
        />

        {/* Alt text display */}
        {images[currentIndex].alt && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 text-white">
            <p className="text-sm">{images[currentIndex].alt}</p>
          </div>
        )}
      </div>

      {/* Image counter */}
      {images.length > 1 && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm"
          style={{ zIndex: 1000000 }}
        >
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div
          className="fixed bottom-20 left-1/2 flex -translate-x-1/2 gap-2"
          style={{ zIndex: 1000000 }}
        >
          {images.map((_, idx) => (
            <button
              key={`lightbox-dot-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(idx);
              }}
              className={`h-2 w-8 rounded-full transition-all ${
                idx === currentIndex
                  ? "bg-white"
                  : "bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};
