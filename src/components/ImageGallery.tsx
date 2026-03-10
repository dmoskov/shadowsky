import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

const FADE_DELAY_MS = 4000;

export function ImageGallery({
  images,
  initialIndex = 0,
  onClose,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start or reset the fade timer
  const resetFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
    }
    setOverlayVisible(true);
    fadeTimerRef.current = setTimeout(() => {
      setOverlayVisible(false);
    }, FADE_DELAY_MS);
  }, []);

  // Clear fade timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);

  // Start fade timer on mount
  useEffect(() => {
    resetFadeTimer();
  }, [resetFadeTimer]);

  // Reset overlay and timer when image changes
  useEffect(() => {
    setImageError(false);
    setImageDimensions(null);
    setZoomed(false);
    resetFadeTimer();
  }, [currentIndex, resetFadeTimer]);

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

  // Toggle overlay on image click
  const handleImageClick = useCallback(() => {
    if (overlayVisible) {
      // Hide immediately and cancel timer
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setOverlayVisible(false);
    } else {
      // Show and start a new fade timer
      resetFadeTimer();
    }
  }, [overlayVisible, resetFadeTimer]);

  // Mouse movement resets fade timer (desktop)
  const handleMouseMove = useCallback(() => {
    if (!overlayVisible) {
      resetFadeTimer();
    } else if (fadeTimerRef.current) {
      // Reset existing timer
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setOverlayVisible(false);
      }, FADE_DELAY_MS);
    }
  }, [overlayVisible, resetFadeTimer]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const toggleZoom = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setZoomed((prev) => !prev);
      resetFadeTimer();
    },
    [resetFadeTimer],
  );

  const overlayTransition = "opacity 0.3s ease-in-out";
  const overlayOpacity = overlayVisible ? 1 : 0;
  const overlayPointerEvents = overlayVisible
    ? ("auto" as const)
    : ("none" as const);

  const currentImage = images[currentIndex];

  return ReactDOM.createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        zIndex: 9999,
        cursor: overlayVisible ? "default" : "none",
      }}
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
    >
      {/* Top bar overlay */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3"
        style={{
          zIndex: 10002,
          opacity: overlayOpacity,
          transition: overlayTransition,
          pointerEvents: overlayPointerEvents,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      >
        {/* Left: counter + dimensions */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </div>
          {imageDimensions && (
            <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
              <ImageIcon size={12} />
              {imageDimensions.width} x {imageDimensions.height}
            </div>
          )}
        </div>

        {/* Right: zoom + close */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleZoom}
            className="touch-target-icon rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
          >
            {zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="touch-target-icon rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            aria-label="Close gallery"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          className="touch-target-icon absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          style={{
            zIndex: 10002,
            opacity: overlayOpacity,
            transition: overlayTransition,
            pointerEvents: overlayPointerEvents,
          }}
          aria-label="Previous image"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="touch-target-icon absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          style={{
            zIndex: 10002,
            opacity: overlayOpacity,
            transition: overlayTransition,
            pointerEvents: overlayPointerEvents,
          }}
          aria-label="Next image"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Main image area */}
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
          overflow: zoomed ? "auto" : "hidden",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleImageClick}
      >
        {imageError ? (
          <div className="p-4 text-center text-white">
            <p>Failed to load image</p>
            <p className="mt-2 text-sm text-white/50">
              URL: {currentImage.fullsize || currentImage.thumb}
            </p>
          </div>
        ) : (
          <img
            key={`${currentIndex}-${currentImage.fullsize}`}
            src={currentImage.fullsize || currentImage.thumb || ""}
            alt={currentImage.alt || `Image ${currentIndex + 1}`}
            style={{
              maxHeight: zoomed ? "none" : "90vh",
              maxWidth: zoomed ? "none" : "90vw",
              height: "auto",
              width: zoomed ? "auto" : "auto",
              objectFit: "contain",
              display: "block",
              position: "relative",
              zIndex: 10001,
              margin: "0 auto",
              backgroundColor: "transparent",
              cursor: zoomed ? "zoom-out" : "pointer",
              transform: zoomed ? "scale(1.5)" : "scale(1)",
              transformOrigin: "center center",
              transition: "transform 0.3s ease",
            }}
            loading="eager"
            onError={() => {
              setImageError(true);
            }}
            onLoad={handleImageLoad}
          />
        )}
      </div>

      {/* Bottom overlay: alt text + thumbnails */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 px-4 pb-4 pt-12"
        style={{
          zIndex: 10002,
          opacity: overlayOpacity,
          transition: overlayTransition,
          pointerEvents: overlayPointerEvents,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      >
        {/* Alt text */}
        {currentImage.alt && (
          <div className="max-w-2xl rounded-lg bg-black/60 px-4 py-2.5 text-center text-sm leading-relaxed text-white/90 backdrop-blur-sm">
            {currentImage.alt}
          </div>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 rounded-lg bg-black/50 p-2 backdrop-blur-sm">
            {images.map((image, index) => (
              <button
                key={`gallery-thumb-${image.thumb}-${index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`touch-target h-12 w-12 overflow-hidden rounded-md transition-all ${
                  index === currentIndex
                    ? "ring-2 ring-white"
                    : "opacity-50 hover:opacity-90"
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
    </div>,
    document.body,
  );
}
