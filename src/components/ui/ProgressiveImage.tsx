import React, { useEffect, useMemo, useRef, useState } from "react";
import { getInitialLoadingStrategy } from "../../hooks/useNetworkAwareLoading";
import { isBskyCdnUrl, requestImage } from "../../services/cdn-request-manager";
import {
  DEFAULT_LQIP_CONFIG,
  generateLQIPUrl,
  getCachedSupport,
  getFormatSupport,
  supportsLQIP,
  transformBskyCdnUrl,
  type LQIPConfig,
} from "../../utils/image-format-support";
import {
  getNetworkInfo,
  subscribeToNetworkChanges,
  type NetworkInfoSnapshot,
  type PrefetchStrategy,
} from "../../utils/network-info";

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
  /** Enable skeleton overlay crossfade (default: true) */
  showSkeleton?: boolean;
  /** Enable LQIP blur-up effect (default: true for supported URLs) */
  enableLQIP?: boolean;
  /** LQIP configuration options */
  lqipConfig?: Partial<LQIPConfig>;
  /**
   * Aspect ratio for CLS prevention (width/height).
   * When provided, the container will reserve space based on this ratio.
   * Can be a number (e.g., 16/9) or preset string ("16:9", "4:3", "square").
   */
  aspectRatio?: number | "16:9" | "4:3" | "3:2" | "2:3" | "square" | "9:16";
  /** Maximum height constraint for the image */
  maxHeight?: number | string;
}

// Track current prefetch strategy for IntersectionObserver rootMargin
let currentPrefetchStrategy: PrefetchStrategy =
  getNetworkInfo().prefetchStrategy;

// Subscribe to network changes and update strategy
if (typeof window !== "undefined") {
  subscribeToNetworkChanges((info: NetworkInfoSnapshot) => {
    currentPrefetchStrategy = info.prefetchStrategy;
  });
}

// Aspect ratio presets for CLS prevention
const ASPECT_RATIO_PRESETS: Record<string, number> = {
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
  square: 1,
  "9:16": 9 / 16,
};

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
  showSkeleton = true,
  enableLQIP = true,
  lqipConfig,
  aspectRatio,
  maxHeight,
}) => {
  const [imgSrc, setImgSrc] = useState(placeholderSrc || "");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [lqipLoaded, setLqipLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const lqipRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Merge LQIP config with defaults
  const mergedLqipConfig = useMemo(
    () => ({ ...DEFAULT_LQIP_CONFIG, ...lqipConfig }),
    [lqipConfig],
  );

  // Determine if we should use LQIP for this image
  const useLQIP = useMemo(
    () => enableLQIP && mergedLqipConfig.enabled && supportsLQIP(src),
    [enableLQIP, mergedLqipConfig.enabled, src],
  );

  // Generate LQIP URL
  const lqipUrl = useMemo(
    () => (useLQIP ? generateLQIPUrl(src, mergedLqipConfig) : ""),
    [useLQIP, src, mergedLqipConfig],
  );

  // Track the last successfully loaded src to prevent re-loading the same image
  const loadedSrcRef = useRef<string | null>(null);

  // Stable callback refs to prevent effect re-runs from callback identity changes
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  // Format support detection for AVIF/WebP optimization
  const [formatSupport, setFormatSupport] = useState(getCachedSupport);

  // Ensure format detection has completed
  useEffect(() => {
    if (formatSupport.avif === null || formatSupport.webp === null) {
      getFormatSupport().then((support) => {
        setFormatSupport(support);
      });
    }
  }, [formatSupport.avif, formatSupport.webp]);

  // Check if this is a Bluesky CDN URL that supports format conversion
  const isBskyCdn = useMemo(() => {
    return src && src.includes("cdn.bsky.app");
  }, [src]);

  // Generate optimized source URLs for picture element
  const optimizedSources = useMemo(() => {
    if (!isBskyCdn || !imgSrc) {
      return [];
    }

    const result: Array<{ url: string; type: string }> = [];

    // Add AVIF source if supported (best compression, ~50% smaller than JPEG)
    if (formatSupport.avif) {
      result.push({
        url: transformBskyCdnUrl(imgSrc, "avif"),
        type: "image/avif",
      });
    }

    // Add WebP source if supported (~30% smaller than JPEG)
    if (formatSupport.webp) {
      result.push({
        url: transformBskyCdnUrl(imgSrc, "webp"),
        type: "image/webp",
      });
    }

    return result;
  }, [imgSrc, isBskyCdn, formatSupport.avif, formatSupport.webp]);

  // Generate a low-quality placeholder if not provided
  // Note: For Bluesky CDN images, prefer using LQIP (generateLQIPUrl) instead
  const getLowQualitySrc = (originalSrc: string) => {
    // If LQIP is enabled and URL supports it, use LQIP URL
    if (useLQIP && lqipUrl) {
      return lqipUrl;
    }
    // If it's a proxied image, add quality parameter for true low quality
    if (originalSrc.includes("/api/image-proxy")) {
      return originalSrc + "&q=10&w=50";
    }
    // For Bluesky CDN images, use thumbnail variant via generateLQIPUrl
    if (originalSrc.includes("cdn.bsky.app")) {
      return generateLQIPUrl(originalSrc);
    }
    return originalSrc;
  };

  // On poor network connections, use lower quality images to save bandwidth
  const networkOptimizedSrc = useMemo(() => {
    const loadingStrategy = getInitialLoadingStrategy();
    if (!loadingStrategy.reduceImageQuality || !src.includes("cdn.bsky.app")) {
      return src;
    }
    // On poor connections, use thumbnail size for all images
    // This significantly reduces data usage on 2G/3G connections
    const url = new URL(src);
    // If the URL already has a size constraint, keep it; otherwise add one
    if (!url.searchParams.has("width") && !src.includes("/feed_")) {
      // Use feed thumbnail size (~300px) instead of full resolution
      return src.replace("/img/", "/img/feed_thumbnail/");
    }
    return src;
  }, [src]);

  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    // Priority images load immediately, no need for observer
    if (priority) {
      setShouldLoad(true);
      return;
    }

    if (shouldLoad) return;

    // Use network-aware rootMargin for prefetching distance
    // On poor connections, reduce prefetch distance to save data
    const rootMarginPercent = currentPrefetchStrategy.rootMarginPercent;
    const rootMargin = `${rootMarginPercent}% 0px ${rootMarginPercent}% 0px`;

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
        // Network-aware preload distance
        // Excellent: 500-800%, Good: 400-600%, Moderate: 200-300%, Poor: 100%
        rootMargin,
        threshold: 0.01,
      },
    );

    const currentElement = containerRef.current || imgRef.current;
    if (currentElement) {
      observerRef.current.observe(currentElement);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;

    // Skip if we've already loaded this exact src
    if (loadedSrcRef.current === src) {
      return;
    }

    // If src changed to a different image, reset state
    if (loadedSrcRef.current !== null && loadedSrcRef.current !== src) {
      setImageLoaded(false);
      setIsLoading(true);
      setHasError(false);
    }

    const lowQualitySrc =
      placeholderSrc || getLowQualitySrc(networkOptimizedSrc);
    setImgSrc(lowQualitySrc);

    // Use CDN request manager for Bluesky CDN images
    if (isBskyCdnUrl(networkOptimizedSrc)) {
      const { promise, abort } = requestImage(
        networkOptimizedSrc,
        priority ? "high" : "normal",
      );

      promise
        .then(() => {
          requestAnimationFrame(() => {
            setImgSrc(networkOptimizedSrc);
            setIsLoading(false);
            loadedSrcRef.current = src;
            requestAnimationFrame(() => {
              setImageLoaded(true);
            });
            onLoadRef.current?.();
          });
        })
        .catch(() => {
          setHasError(true);
          setIsLoading(false);
          onErrorRef.current?.();
        });

      return () => {
        abort();
      };
    }

    // For non-CDN images, load directly
    const img = new Image();

    img.onload = () => {
      requestAnimationFrame(() => {
        setImgSrc(networkOptimizedSrc);
        setIsLoading(false);
        loadedSrcRef.current = src;
        requestAnimationFrame(() => {
          setImageLoaded(true);
        });
        onLoadRef.current?.();
      });
      img.onload = null;
      img.onerror = null;
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onErrorRef.current?.();
      img.onload = null;
      img.onerror = null;
    };

    img.src = networkOptimizedSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, networkOptimizedSrc, placeholderSrc, shouldLoad, priority]);

  // Calculate aspect ratio for CLS prevention (must be before early return)
  const computedAspectRatio = useMemo(() => {
    // If explicit aspectRatio prop provided
    if (aspectRatio) {
      return typeof aspectRatio === "number"
        ? aspectRatio
        : ASPECT_RATIO_PRESETS[aspectRatio] || 16 / 9;
    }
    // Calculate from width/height if both provided
    if (width && height) {
      return width / height;
    }
    // No aspect ratio (will not reserve space)
    return undefined;
  }, [aspectRatio, width, height]);

  // Container styles for CLS prevention (must be before early return)
  const containerStyles = useMemo((): React.CSSProperties => {
    const styles: React.CSSProperties = {
      ...style,
    };

    // Apply aspect ratio for CLS prevention (reserves space before image loads)
    if (computedAspectRatio) {
      styles.aspectRatio = computedAspectRatio;
    } else if (height) {
      // Use explicit height if no aspect ratio
      styles.height = typeof height === "number" ? `${height}px` : height;
    } else {
      styles.height = "auto";
    }

    // Apply width
    styles.width = width
      ? typeof width === "number"
        ? `${width}px`
        : width
      : "100%";

    // Apply max height constraint
    if (maxHeight) {
      styles.maxHeight =
        typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
    }

    return styles;
  }, [style, computedAspectRatio, width, height, maxHeight]);

  // Error state
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-asph-bg-tertiary ${className}`}
        style={{ width: width || "100%", height: height || "100%", ...style }}
        role="img"
        aria-label={`Failed to load: ${alt}`}
      >
        <div className="flex flex-col items-center gap-2 text-asph-text-tertiary">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">Failed to load</span>
        </div>
      </div>
    );
  }

  // Handle LQIP load event
  const handleLqipLoad = () => {
    setLqipLoaded(true);
  };

  // Render with LQIP blur-up effect or skeleton overlay
  return (
    <div
      ref={containerRef}
      className={`progressive-image-container media-placeholder-wrapper relative overflow-hidden ${className}`}
      style={containerStyles}
      data-aspect-ratio={computedAspectRatio ? "true" : undefined}
      data-loaded={imageLoaded ? "true" : "false"}
    >
      {/* LQIP (Low-Quality Image Placeholder) layer with blur effect */}
      {useLQIP && lqipUrl && (
        <img
          ref={lqipRef}
          src={lqipUrl}
          alt=""
          aria-hidden="true"
          className="lqip-placeholder"
          onLoad={handleLqipLoad}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "inherit",
            // Blur effect that transitions out as full image loads
            filter: `blur(${mergedLqipConfig.blurRadius}px)`,
            // Scale up slightly to hide blur edges
            transform: "scale(1.1)",
            opacity: imageLoaded ? 0 : lqipLoaded ? 1 : 0,
            transition: `opacity ${mergedLqipConfig.transitionDuration}ms var(--ease-entrance, cubic-bezier(0, 0, 0.2, 1)), filter ${mergedLqipConfig.transitionDuration}ms var(--ease-entrance, cubic-bezier(0, 0, 0.2, 1))`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      {/* Skeleton overlay - fades out when LQIP loads or image loads */}
      {showSkeleton && (
        <div
          className="absolute inset-0 animate-pulse bg-asph-bg-tertiary"
          style={{
            opacity: lqipLoaded || imageLoaded ? 0 : 1,
            transition:
              "opacity var(--transition-slow, 300ms) var(--ease-entrance, cubic-bezier(0, 0, 0.2, 1))",
            pointerEvents: lqipLoaded || imageLoaded ? "none" : "auto",
            zIndex: 0,
          }}
          aria-hidden="true"
        />
      )}

      {/* Full-resolution image with AVIF/WebP fallback chain using picture element */}
      {optimizedSources.length > 0 ? (
        <picture>
          {optimizedSources.map((source) => (
            <source key={source.type} srcSet={source.url} type={source.type} />
          ))}
          <img
            ref={imgRef}
            src={imgSrc}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            className="progressive-image-full"
            style={{
              opacity: imageLoaded ? 1 : 0,
              transition: `opacity ${mergedLqipConfig.transitionDuration}ms var(--ease-entrance, cubic-bezier(0, 0, 0.2, 1))`,
              willChange: isLoading ? "opacity" : "auto",
              backfaceVisibility: "hidden",
              width: "100%",
              height: "100%",
              objectFit: "inherit",
              filter: style?.filter,
              position: "relative",
              zIndex: 2,
            }}
            width={width}
            height={height}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
              onError?.();
            }}
          />
        </picture>
      ) : (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className="progressive-image-full"
          style={{
            opacity: imageLoaded ? 1 : 0,
            transition: `opacity ${mergedLqipConfig.transitionDuration}ms var(--ease-entrance, cubic-bezier(0, 0, 0.2, 1))`,
            willChange: isLoading ? "opacity" : "auto",
            backfaceVisibility: "hidden",
            width: "100%",
            height: "100%",
            objectFit: "inherit",
            filter: style?.filter,
            position: "relative",
            zIndex: 2,
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
    </div>
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
