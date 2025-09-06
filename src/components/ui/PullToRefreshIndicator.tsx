import React from "react";
import { RefreshCw } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
  progress: number;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  threshold: _threshold,
  progress
}) => {
  const rotation = progress * 180;
  const scale = 0.5 + progress * 0.5;
  const opacity = Math.min(progress * 2, 1);
  
  if (pullDistance === 0 && !isRefreshing) {
    return null;
  }

  return (
    <div 
      className="absolute left-0 right-0 top-0 flex justify-center pointer-events-none z-10"
      style={{
        height: `${pullDistance}px`,
        transition: isRefreshing ? 'height 0.2s ease-out' : 'none'
      }}
    >
      <div 
        className="flex items-center justify-center"
        style={{
          marginTop: pullDistance > 40 ? (pullDistance - 40) / 2 : 0,
          transition: 'transform 0.2s ease-out'
        }}
      >
        <div
          className="relative flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-lg"
          style={{
            width: 40,
            height: 40,
            transform: `scale(${scale})`,
            opacity
          }}
        >
          <RefreshCw 
            size={20} 
            className={`${isRefreshing ? 'animate-spin' : ''} transition-transform`}
            style={{
              color: progress >= 1 ? 'var(--bsky-primary)' : 'var(--bsky-text-secondary)',
              transform: `rotate(${rotation}deg)`
            }}
          />
          
          {/* Progress ring */}
          <svg
            className="absolute inset-0"
            viewBox="0 0 40 40"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="var(--bsky-border-primary)"
              strokeWidth="2"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="var(--bsky-primary)"
              strokeWidth="2"
              strokeDasharray={`${progress * 113} 113`}
              className="transition-all duration-200"
            />
          </svg>
        </div>
      </div>
      
      {/* Pull text */}
      {!isRefreshing && pullDistance > 30 && (
        <div
          className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium"
          style={{
            color: 'var(--bsky-text-secondary)',
            opacity: Math.min((pullDistance - 30) / 20, 1)
          }}
        >
          {progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
    </div>
  );
};