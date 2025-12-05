import React, { useEffect, useMemo, useState } from "react";
import {
  getCachedSupport,
  getFormatSupport,
  transformBskyCdnUrl,
} from "../../utils/image-format-support";

export interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  onLoad?: () => void;
  onError?: () => void;
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
}

/**
 * OptimizedImage component that uses the HTML picture element
 * to provide AVIF → WebP → JPEG fallback chain.
 *
 * Features:
 * - Automatic format detection and selection
 * - Uses picture element for native browser format negotiation
 * - Falls back gracefully to JPEG for unsupported browsers
 * - Works with Bluesky CDN URLs that support format conversion
 * - For non-CDN URLs, renders a standard img tag
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = "",
  style,
  width,
  height,
  loading = "lazy",
  decoding = "async",
  onLoad,
  onError,
  fetchPriority,
  sizes,
}) => {
  // Get cached format support (synchronous, may be null initially)
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

  // Generate source URLs for different formats
  const sources = useMemo(() => {
    if (!isBskyCdn || !src) {
      return [];
    }

    const result: Array<{ url: string; type: string }> = [];

    // Add AVIF source if supported
    if (formatSupport.avif) {
      result.push({
        url: transformBskyCdnUrl(src, "avif"),
        type: "image/avif",
      });
    }

    // Add WebP source if supported
    if (formatSupport.webp) {
      result.push({
        url: transformBskyCdnUrl(src, "webp"),
        type: "image/webp",
      });
    }

    return result;
  }, [src, isBskyCdn, formatSupport.avif, formatSupport.webp]);

  // Common img props
  const imgProps = {
    alt,
    className,
    style,
    width,
    height,
    loading,
    decoding,
    onLoad,
    onError,
    ...(fetchPriority && { fetchPriority }),
    ...(sizes && { sizes }),
  };

  // If not a Bluesky CDN URL or no modern formats supported,
  // render a simple img tag
  if (!isBskyCdn || sources.length === 0) {
    return <img src={src} {...imgProps} />;
  }

  // Use picture element with format sources
  return (
    <picture>
      {sources.map((source) => (
        <source key={source.type} srcSet={source.url} type={source.type} />
      ))}
      <img src={src} {...imgProps} />
    </picture>
  );
};

/**
 * Hook to get the best image URL for a given source
 * Returns the optimal format URL based on browser support
 */
export function useOptimizedImageUrl(src: string): {
  url: string;
  format: string;
  isOptimized: boolean;
} {
  const [formatSupport, setFormatSupport] = useState(getCachedSupport);

  useEffect(() => {
    if (formatSupport.avif === null || formatSupport.webp === null) {
      getFormatSupport().then((support) => {
        setFormatSupport(support);
      });
    }
  }, [formatSupport.avif, formatSupport.webp]);

  return useMemo(() => {
    if (!src || !src.includes("cdn.bsky.app")) {
      return { url: src, format: "original", isOptimized: false };
    }

    if (formatSupport.avif) {
      return {
        url: transformBskyCdnUrl(src, "avif"),
        format: "avif",
        isOptimized: true,
      };
    }

    if (formatSupport.webp) {
      return {
        url: transformBskyCdnUrl(src, "webp"),
        format: "webp",
        isOptimized: true,
      };
    }

    return { url: src, format: "jpeg", isOptimized: false };
  }, [src, formatSupport.avif, formatSupport.webp]);
}

export default OptimizedImage;
