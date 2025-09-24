import React, { useEffect, useRef, useState } from "react";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  placeholderSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean; // Skip lazy loading for above-the-fold images
}

// Increase concurrent loads since we're preloading further ahead
const MAX_CONCURRENT_LOADS = window.innerWidth < 768 ? 6 : 12;
let currentLoads = 0;
const loadQueue: Array<() => void> = [];

function processLoadQueue() {
  while (currentLoads < MAX_CONCURRENT_LOADS && loadQueue.length > 0) {
    const loadFn = loadQueue.shift();
    if (loadFn) {
      currentLoads++;
      loadFn();
    }
  }
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = "",
  style,
  width,
  height,
  placeholderSrc,
  onLoad,
  onError,
  priority = false,
}) => {
  const [imgSrc, setImgSrc] = useState(placeholderSrc || "");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate a low-quality placeholder if not provided
  const getLowQualitySrc = (originalSrc: string) => {
    // If it's a proxied image, add quality parameter for true low quality
    if (originalSrc.includes("/api/image-proxy")) {
      return originalSrc + "&q=10&w=50";
    }
    // For Bluesky CDN images, use thumbnail variant
    if (originalSrc.includes("cdn.bsky.app")) {
      return originalSrc
        .replace("@jpeg", "@jpeg")
        .replace(/format=\w+/, "format=webp");
    }
    return originalSrc;
  };

  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    // Priority images load immediately, no need for observer
    if (priority) {
      setShouldLoad(true);
      return;
    }

    if (shouldLoad) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        // Preload images WAY before they enter viewport
        // Mobile: 5 viewport heights, Desktop: 8 viewport heights
        // This ensures images are fully loaded even with moderate scrolling
        rootMargin:
          window.innerWidth < 768 ? "500% 0px 500% 0px" : "800% 0px 800% 0px",
        threshold: 0.01,
      },
    );

    const currentElement = imgRef.current;
    if (currentElement) {
      observerRef.current.observe(currentElement);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;

    const lowQualitySrc = placeholderSrc || getLowQualitySrc(src);
    setImgSrc(lowQualitySrc);

    const loadImage = () => {
      const img = new Image();

      img.onload = () => {
        // Add small delay to ensure smooth transition
        requestAnimationFrame(() => {
          setImgSrc(src);
          setIsLoading(false);
          onLoad?.();
        });
        currentLoads--;
        processLoadQueue();
        // Clear image reference to free memory
        img.onload = null;
        img.onerror = null;
      };

      img.onerror = () => {
        setHasError(true);
        setIsLoading(false);
        onError?.();
        currentLoads--;
        processLoadQueue();
        // Clear image reference to free memory
        img.onload = null;
        img.onerror = null;
      };

      img.src = src;
    };

    // Queue the image load
    if (priority) {
      // Priority images skip the queue
      currentLoads++;
      loadImage();
    } else {
      loadQueue.push(loadImage);
      processLoadQueue();
    }

    return () => {
      // Remove from queue if component unmounts
      const index = loadQueue.findIndex((fn) => fn === loadImage);
      if (index > -1) {
        loadQueue.splice(index, 1);
      }
    };
  }, [src, placeholderSrc, shouldLoad, onLoad, onError, priority]);

  return (
    <>
      {hasError ? (
        <div
          className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 ${className}`}
          style={{ width: width || "100%", height: height || "100%", ...style }}
        >
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Failed to load image
          </span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className={`${className} ${isLoading ? "blur-sm" : ""}`}
          style={{
            transition: "filter 0.2s ease-out",
            // Mobile performance optimizations
            willChange: "auto",
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
            width: width || undefined,
            height: height || undefined,
            ...style,
          }}
          width={width}
          height={height}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
            onError?.();
          }}
        />
      )}
    </>
  );
};

// Hook for progressive image loading
export const useProgressiveImage = (src: string, placeholderSrc?: string) => {
  const [source, setSource] = useState(placeholderSrc || "");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      setSource(src);
      setIsLoading(false);
    };

    img.src = src;

    // Set placeholder immediately
    if (placeholderSrc) {
      setSource(placeholderSrc);
    }

    return () => {
      img.onload = null;
    };
  }, [src, placeholderSrc]);

  return { source, isLoading };
};
