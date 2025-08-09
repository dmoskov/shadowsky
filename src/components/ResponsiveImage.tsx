import React, { useState } from 'react';

interface ResponsiveImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  maxHeight?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt = '',
  className = '',
  onClick,
  maxHeight = 'max-h-96',
  aspectRatio = 'auto'
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'video':
        return 'aspect-video';
      default:
        return '';
    }
  };

  if (imageError) {
    return (
      <div className={`flex items-center justify-center bg-bsky-bg-tertiary rounded-lg ${maxHeight} ${getAspectRatioClass()} ${className}`}>
        <span className="text-bsky-text-tertiary text-sm">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-bsky-bg-tertiary ${getAspectRatioClass()} ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-bsky-bg-secondary" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full ${maxHeight} object-contain ${onClick ? 'cursor-pointer hover:opacity-95' : ''} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onClick={onClick}
        onLoad={() => setIsLoading(false)}
        onError={() => setImageError(true)}
        loading="lazy"
      />
    </div>
  );
};