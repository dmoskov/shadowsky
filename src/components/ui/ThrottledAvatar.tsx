/**
 * ThrottledAvatar - Avatar component with CDN rate limiting
 *
 * Uses the CDN request manager to prevent flooding cdn.bsky.app with requests.
 * Supports visibility-based priority loading.
 */

import React, { useEffect, useRef, useState } from "react";
import { isBskyCdnUrl, requestImage } from "../../services/cdn-request-manager";
import { proxifyBskyImage } from "../../utils/image-proxy";

interface ThrottledAvatarProps {
  src: string | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  /** Fallback content to show when no avatar */
  fallbackInitial?: string;
  /** Whether this avatar is above the fold / high priority */
  priority?: boolean;
}

const ThrottledAvatarComponent: React.FC<ThrottledAvatarProps> = ({
  src,
  alt,
  className = "",
  style,
  onClick,
  fallbackInitial,
  priority = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Use proxified URL for cdn.bsky.app images
  const imageUrl = src ? proxifyBskyImage(src) : undefined;
  const isCdnImage = imageUrl && isBskyCdnUrl(imageUrl);

  // Track visibility with IntersectionObserver
  useEffect(() => {
    if (priority || !imgRef.current) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "100px",
        threshold: 0,
      },
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Load image through CDN manager when visible
  useEffect(() => {
    if (!isVisible || !imageUrl || !isCdnImage) {
      // For non-CDN images, load directly
      if (imageUrl && !isCdnImage) {
        setLoaded(true);
      }
      return;
    }

    // Abort previous request if URL changed
    if (abortRef.current) {
      abortRef.current();
    }

    const { promise, abort } = requestImage(
      imageUrl,
      priority ? "high" : "normal",
    );
    abortRef.current = abort;

    promise
      .then(() => {
        setLoaded(true);
        setFailed(false);
      })
      .catch(() => {
        setFailed(true);
      });

    return () => {
      if (abortRef.current) {
        abortRef.current();
      }
    };
  }, [imageUrl, isCdnImage, isVisible, priority]);

  // Fallback UI when no src or failed to load
  if (!src || failed) {
    const initial = fallbackInitial || alt?.charAt(0)?.toUpperCase() || "?";
    return (
      <div
        ref={imgRef}
        className={`flex items-center justify-center rounded-full ${className}`}
        style={{
          background: "var(--bsky-bg-tertiary)",
          ...style,
        }}
        onClick={onClick}
        role="img"
        aria-label={alt}
      >
        <span
          className="font-semibold"
          style={{
            fontSize: "inherit",
            color: "var(--bsky-text-secondary)",
          }}
        >
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden rounded-full ${className}`}
      style={style}
      onClick={onClick}
      role="img"
      aria-label={alt}
    >
      {/* Skeleton placeholder */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse rounded-full"
          style={{ background: "var(--bsky-bg-tertiary)" }}
        />
      )}

      {/* Actual image - only render src when loaded or non-CDN */}
      <img
        src={loaded || !isCdnImage ? imageUrl : undefined}
        alt={alt}
        className={`h-full w-full rounded-full object-cover transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

/**
 * Memoized ThrottledAvatar for optimal feed scroll performance
 * Prevents unnecessary re-renders when parent components update
 */
export const ThrottledAvatar = React.memo(
  ThrottledAvatarComponent,
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return (
      prevProps.src === nextProps.src &&
      prevProps.alt === nextProps.alt &&
      prevProps.className === nextProps.className &&
      prevProps.priority === nextProps.priority &&
      prevProps.fallbackInitial === nextProps.fallbackInitial
      // onClick and style are expected to be stable
    );
  },
);

ThrottledAvatar.displayName = "ThrottledAvatar";

export default ThrottledAvatar;
