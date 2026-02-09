import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Responsive Placeholder System for CLS Prevention
 *
 * These components reserve exact space for content before it loads,
 * preventing Cumulative Layout Shift (CLS).
 *
 * Features:
 * - Aspect-ratio based sizing for images/video
 * - Container query aware responsive behavior
 * - Smooth loading transitions
 * - Reduced motion support
 * - Zero CLS score for protected areas
 */

// Common aspect ratios
export const ASPECT_RATIOS = {
  square: 1,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
  "9:16": 9 / 16,
  "2:1": 2 / 1,
  "1:2": 1 / 2,
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

interface BasePlaceholderProps {
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
}

interface AspectRatioPlaceholderProps extends BasePlaceholderProps {
  /** Aspect ratio as a number (width/height) or preset key */
  aspectRatio?: number | AspectRatioKey;
  /** Maximum height constraint */
  maxHeight?: number | string;
  /** Whether to show loading animation */
  animated?: boolean;
  /** Whether to show shimmer effect */
  shimmer?: boolean;
}

/**
 * AspectRatioPlaceholder - Reserves space based on aspect ratio
 *
 * Use this for images, videos, or any media with known aspect ratio
 * to prevent layout shift.
 */
export const AspectRatioPlaceholder: React.FC<AspectRatioPlaceholderProps> = ({
  aspectRatio = "16:9",
  maxHeight,
  animated = true,
  shimmer = false,
  className = "",
  children,
  "aria-label": ariaLabel = "Loading content",
}) => {
  const ratio =
    typeof aspectRatio === "number"
      ? aspectRatio
      : ASPECT_RATIOS[aspectRatio] || 16 / 9;

  const style: React.CSSProperties = {
    aspectRatio: ratio,
    maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
  };

  return (
    <div
      className={`placeholder-base placeholder-image ${animated ? "placeholder-animated" : ""} ${shimmer ? "placeholder-shimmer" : ""} ${className} `.trim()}
      style={style}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {children}
    </div>
  );
};

interface MediaPlaceholderWrapperProps extends BasePlaceholderProps {
  /** Aspect ratio for the media */
  aspectRatio?: number | AspectRatioKey;
  /** Width of the media in pixels */
  width?: number;
  /** Height of the media in pixels */
  height?: number;
  /** Maximum height constraint */
  maxHeight?: number | string;
  /** Whether the content has loaded */
  isLoaded?: boolean;
  /** Callback when content loads */
  onLoad?: () => void;
  /** Whether to show loading animation */
  animated?: boolean;
}

/**
 * MediaPlaceholderWrapper - Wraps media content with stable dimensions
 *
 * Maintains consistent dimensions during the loading process to prevent CLS.
 * Shows a placeholder overlay that fades out when content loads.
 */
export const MediaPlaceholderWrapper: React.FC<
  MediaPlaceholderWrapperProps
> = ({
  aspectRatio,
  width,
  height,
  maxHeight,
  isLoaded = false,
  animated = true,
  className = "",
  children,
  "aria-label": ariaLabel = "Loading media",
}) => {
  // Calculate aspect ratio from width/height if provided
  const calculatedRatio =
    width && height
      ? width / height
      : aspectRatio
        ? typeof aspectRatio === "number"
          ? aspectRatio
          : ASPECT_RATIOS[aspectRatio]
        : undefined;

  const style: React.CSSProperties = {
    ...(calculatedRatio && { aspectRatio: calculatedRatio }),
    ...(height && !calculatedRatio && { height: `${height}px` }),
    ...(maxHeight && {
      maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
    }),
  };

  return (
    <div
      className={`media-placeholder-wrapper ${className}`}
      style={style}
      data-loaded={isLoaded}
      data-aspect-ratio={calculatedRatio ? true : undefined}
      role={isLoaded ? undefined : "status"}
      aria-label={isLoaded ? undefined : ariaLabel}
      aria-busy={!isLoaded}
    >
      {/* Placeholder layer - fades out when loaded */}
      <div
        className={`placeholder-layer ${animated ? "placeholder-animated" : ""}`}
        aria-hidden="true"
      />

      {/* Content layer */}
      <div className="content-layer">{children}</div>
    </div>
  );
};

interface ImageGridPlaceholderProps extends BasePlaceholderProps {
  /** Number of images in the grid (1-4) */
  count: number;
  /** Custom aspect ratio for individual images */
  imageAspectRatio?: number | AspectRatioKey;
}

/**
 * ImageGridPlaceholder - Placeholder for image grid layouts
 *
 * Creates placeholder layout matching the grid structure for
 * 1, 2, 3, or 4 images.
 */
export const ImageGridPlaceholder: React.FC<ImageGridPlaceholderProps> = ({
  count,
  imageAspectRatio = "16:9",
  className = "",
  "aria-label": ariaLabel = "Loading images",
}) => {
  const gridClass =
    count === 1
      ? "placeholder-image-grid-1"
      : count === 2
        ? "placeholder-image-grid-2"
        : count === 3
          ? "placeholder-image-grid-3 placeholder-image-grid-3-special"
          : "placeholder-image-grid-4";

  const ratio =
    typeof imageAspectRatio === "number"
      ? imageAspectRatio
      : ASPECT_RATIOS[imageAspectRatio] || 16 / 9;

  return (
    <div
      className={`placeholder-image-grid ${gridClass} ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => {
        const isFirstOfThree = count === 3 && i === 0;
        const aspectRatioValue = isFirstOfThree ? 1 : ratio;

        return (
          <div
            key={`image-placeholder-${i}`}
            className="placeholder-image placeholder-animated"
            style={{
              aspectRatio: aspectRatioValue,
              maxHeight: isFirstOfThree ? "500px" : "350px",
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};

interface VideoPlaceholderProps extends BasePlaceholderProps {
  /** Aspect ratio of the video */
  aspectRatio?: number | AspectRatioKey;
  /** Show play button indicator */
  showPlayButton?: boolean;
  /** Thumbnail URL (if available) */
  thumbnailUrl?: string;
}

/**
 * VideoPlaceholder - Placeholder for video content
 *
 * Shows a video-specific placeholder with optional play button
 * and thumbnail image.
 */
export const VideoPlaceholder: React.FC<VideoPlaceholderProps> = ({
  aspectRatio = "16:9",
  showPlayButton = true,
  thumbnailUrl,
  className = "",
  "aria-label": ariaLabel = "Loading video",
}) => {
  const ratio =
    typeof aspectRatio === "number"
      ? aspectRatio
      : ASPECT_RATIOS[aspectRatio] || 16 / 9;

  return (
    <div
      className={`placeholder-video ${className}`}
      style={{ aspectRatio: ratio }}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          aria-hidden="true"
        />
      )}
      {!showPlayButton && (
        <>
          {/* Hide the CSS pseudo-element play button */}
          <style>{`.placeholder-video::before, .placeholder-video::after { display: none !important; }`}</style>
        </>
      )}
    </div>
  );
};

interface AvatarPlaceholderProps extends BasePlaceholderProps {
  /** Size preset or custom size in pixels */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
}

/**
 * AvatarPlaceholder - Circular placeholder for avatars
 */
export const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Loading avatar",
}) => {
  const sizeClass =
    typeof size === "string" ? `placeholder-avatar-${size}` : "";
  const customStyle =
    typeof size === "number" ? { width: size, height: size } : undefined;

  return (
    <div
      className={`placeholder-avatar placeholder-animated ${sizeClass} ${className}`}
      style={customStyle}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    />
  );
};

interface TextPlaceholderProps extends BasePlaceholderProps {
  /** Number of lines */
  lines?: number;
  /** Width of each line (can be array for varying widths) */
  widths?: (string | number)[];
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * TextPlaceholder - Placeholder for text content
 *
 * Creates multiple placeholder lines with varying widths
 * for a natural loading appearance.
 */
export const TextPlaceholder: React.FC<TextPlaceholderProps> = ({
  lines = 3,
  widths = ["100%", "90%", "70%"],
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Loading text",
}) => {
  const sizeClass =
    size === "sm"
      ? "placeholder-text-sm"
      : size === "lg"
        ? "placeholder-text-lg"
        : "";

  return (
    <div
      className={`placeholder-text-lines ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {Array.from({ length: lines }).map((_, i) => {
        const width = widths[i] || widths[widths.length - 1] || "100%";
        return (
          <div
            key={`text-placeholder-${i}-${width}`}
            className={`placeholder-text placeholder-animated ${sizeClass}`}
            style={{
              width: typeof width === "number" ? `${width}px` : width,
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};

interface EmbedCardPlaceholderProps extends BasePlaceholderProps {
  /** Whether the embed has an image preview */
  hasImage?: boolean;
}

/**
 * EmbedCardPlaceholder - Placeholder for external link cards
 */
export const EmbedCardPlaceholder: React.FC<EmbedCardPlaceholderProps> = ({
  hasImage = true,
  className = "",
  "aria-label": ariaLabel = "Loading link preview",
}) => {
  return (
    <div
      className={`placeholder-embed-card ${hasImage ? "placeholder-embed-card-with-image" : ""} ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {hasImage && (
        <div className="placeholder-embed-card-image placeholder-animated" />
      )}
      <div className="placeholder-embed-card-content">
        <div className="mb-1">
          <TextPlaceholder lines={1} widths={["40%"]} size="sm" />
        </div>
        <TextPlaceholder lines={2} widths={["80%", "60%"]} />
      </div>
    </div>
  );
};

interface QuotePostPlaceholderProps extends BasePlaceholderProps {
  /** Whether to include image placeholder */
  hasImage?: boolean;
}

/**
 * QuotePostPlaceholder - Placeholder for quoted posts
 */
export const QuotePostPlaceholder: React.FC<QuotePostPlaceholderProps> = ({
  hasImage = false,
  className = "",
  "aria-label": ariaLabel = "Loading quoted post",
}) => {
  return (
    <div
      className={`placeholder-quote-post ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      <div className="mb-2 flex items-center gap-2">
        <AvatarPlaceholder size="xs" />
        <TextPlaceholder lines={1} widths={["120px"]} />
      </div>
      <TextPlaceholder lines={2} widths={["100%", "80%"]} />
      {hasImage && (
        <div className="mt-2">
          <AspectRatioPlaceholder aspectRatio="16:9" maxHeight={200} />
        </div>
      )}
    </div>
  );
};

interface PostPlaceholderProps extends BasePlaceholderProps {
  /** Whether to include image placeholder */
  hasImage?: boolean;
  /** Number of text lines */
  textLines?: number;
}

/**
 * PostPlaceholder - Full post placeholder
 *
 * Creates a complete post skeleton with avatar, header,
 * content, and actions.
 */
export const PostPlaceholder: React.FC<PostPlaceholderProps> = ({
  hasImage = false,
  textLines = 3,
  className = "",
  "aria-label": ariaLabel = "Loading post",
}) => {
  return (
    <div
      className={`placeholder-post ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      <div className="placeholder-post-avatar placeholder-animated" />
      <div className="placeholder-post-content">
        <div className="placeholder-post-header">
          <div className="placeholder-post-name placeholder-animated" />
          <div className="placeholder-post-handle placeholder-animated" />
        </div>
        <div className="placeholder-post-body">
          <TextPlaceholder lines={textLines} />
          {hasImage && (
            <div className="mt-2">
              <AspectRatioPlaceholder aspectRatio="16:9" maxHeight={350} />
            </div>
          )}
        </div>
        <div className="placeholder-post-actions">
          <div className="placeholder-post-action placeholder-animated" />
          <div className="placeholder-post-action placeholder-animated" />
          <div className="placeholder-post-action placeholder-animated" />
        </div>
      </div>
    </div>
  );
};

// Hook for managing placeholder state with loading detection
interface UsePlaceholderOptions {
  /** Delay before showing placeholder (ms) */
  showDelay?: number;
  /** Minimum time to show placeholder (ms) */
  minShowTime?: number;
}

interface UsePlaceholderReturn {
  isLoading: boolean;
  showPlaceholder: boolean;
  startLoading: () => void;
  finishLoading: () => void;
}

/**
 * usePlaceholder - Hook for managing placeholder visibility
 *
 * Handles timing for showing/hiding placeholders to prevent
 * flashing during quick loads while ensuring minimum visibility.
 */
export function usePlaceholder(
  options: UsePlaceholderOptions = {},
): UsePlaceholderReturn {
  const { showDelay = 150, minShowTime = 300 } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const loadStartRef = useRef<number | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback(() => {
    loadStartRef.current = Date.now();
    setIsLoading(true);

    // Delay showing placeholder for quick loads
    showTimeoutRef.current = setTimeout(() => {
      setShowPlaceholder(true);
    }, showDelay);
  }, [showDelay]);

  const finishLoading = useCallback(() => {
    const startTime = loadStartRef.current;
    const elapsed = startTime ? Date.now() - startTime : 0;

    // Clear show delay timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    // Ensure minimum show time if placeholder is visible
    if (showPlaceholder && elapsed < minShowTime) {
      setTimeout(() => {
        setIsLoading(false);
        setShowPlaceholder(false);
      }, minShowTime - elapsed);
    } else {
      setIsLoading(false);
      setShowPlaceholder(false);
    }

    loadStartRef.current = null;
  }, [showPlaceholder, minShowTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    showPlaceholder,
    startLoading,
    finishLoading,
  };
}

/**
 * useIntrinsicSize - Hook for calculating intrinsic image/video dimensions
 *
 * Returns dimensions that can be used to prevent CLS by reserving
 * space before the media loads.
 */
export function useIntrinsicSize(
  src: string | undefined,
  fallbackAspectRatio: number = 16 / 9,
): {
  width: number | undefined;
  height: number | undefined;
  aspectRatio: number;
} {
  const [dimensions, setDimensions] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({ width: undefined, height: undefined });

  useEffect(() => {
    if (!src) {
      setDimensions({ width: undefined, height: undefined });
      return;
    }

    // Try to extract dimensions from URL parameters (common CDN pattern)
    const urlParams = new URLSearchParams(src.split("?")[1] || "");
    const urlWidth = urlParams.get("w") || urlParams.get("width");
    const urlHeight = urlParams.get("h") || urlParams.get("height");

    if (urlWidth && urlHeight) {
      setDimensions({
        width: parseInt(urlWidth, 10),
        height: parseInt(urlHeight, 10),
      });
      return;
    }

    // Otherwise, we'll use the fallback aspect ratio
    setDimensions({ width: undefined, height: undefined });
  }, [src]);

  const aspectRatio =
    dimensions.width && dimensions.height
      ? dimensions.width / dimensions.height
      : fallbackAspectRatio;

  return { ...dimensions, aspectRatio };
}
