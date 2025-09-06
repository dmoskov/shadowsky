import React, { useState, useEffect } from "react";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholderSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = "",
  width,
  height,
  placeholderSrc,
  onLoad,
  onError,
}) => {
  const [imgSrc, setImgSrc] = useState(placeholderSrc || "");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate a low-quality placeholder if not provided
  const getLowQualitySrc = (originalSrc: string) => {
    // If it's a proxied image, add quality parameter
    if (originalSrc.includes("/api/image-proxy")) {
      return originalSrc + "&q=20&blur=20";
    }
    // For Bluesky CDN images, use thumbnail variant
    if (originalSrc.includes("cdn.bsky.app")) {
      return originalSrc.replace("@jpeg", "@jpeg").replace(/format=\w+/, "format=webp");
    }
    return originalSrc;
  };

  useEffect(() => {
    // Load low quality version first
    const lowQualitySrc = placeholderSrc || getLowQualitySrc(src);
    
    // Create image object to preload high quality version
    const img = new Image();
    
    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
      onLoad?.();
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };
    
    // Start with low quality
    setImgSrc(lowQualitySrc);
    
    // Load high quality
    img.src = src;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, placeholderSrc, onLoad, onError]);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-500 dark:text-gray-400 text-sm">
          Failed to load image
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      <img
        src={imgSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-300 ${
          isLoading ? "filter blur-sm scale-105" : "filter-none scale-100"
        }`}
        style={{
          transition: "filter 0.3s ease-out, transform 0.3s ease-out",
        }}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100/50 to-gray-200/50 dark:from-gray-800/50 dark:to-gray-700/50 animate-pulse" />
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