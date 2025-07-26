import React, { useEffect, useState } from 'react'

interface FeedLoadingProgressProps {
  postsLoaded: number
  isInitialLoad: boolean
  isFetchingMore: boolean
}

export const FeedLoadingProgress: React.FC<FeedLoadingProgressProps> = ({ 
  postsLoaded, 
  isInitialLoad,
  isFetchingMore 
}) => {
  const [progress, setProgress] = useState(0)
  const [estimatedTotal, setEstimatedTotal] = useState(50) // Initial estimate
  
  useEffect(() => {
    // Update progress based on loaded posts
    if (isInitialLoad) {
      // Initial load animation
      const timer = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 100)
      
      return () => clearInterval(timer)
    } else if (postsLoaded > 0) {
      // Estimate progress based on typical feed patterns
      // Most feeds load ~20-30 posts per page
      const pagesLoaded = Math.ceil(postsLoaded / 25)
      const estimatedProgress = Math.min((pagesLoaded / 4) * 100, 95) // Cap at 95%
      setProgress(estimatedProgress)
      
      // Adjust estimated total based on loading pattern
      if (isFetchingMore && postsLoaded > estimatedTotal * 0.8) {
        setEstimatedTotal(prev => prev + 25)
      }
    }
  }, [postsLoaded, isInitialLoad, isFetchingMore, estimatedTotal])

  return (
    <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      {/* Progress Bar */}
      <div className="h-1 bg-gray-800 relative overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                          animate-shimmer" />
        </div>
      </div>
      
      {/* Loading Status */}
      <div className="px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-3">
          {isInitialLoad ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-blue-500 rounded-full" />
              <span className="text-gray-400">Loading your timeline...</span>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-gray-400">
                  {isFetchingMore ? 'Loading more posts...' : 'Timeline updated'}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Post Count */}
        {!isInitialLoad && postsLoaded > 0 && (
          <div className="text-gray-500 text-xs">
            {postsLoaded} {postsLoaded === 1 ? 'post' : 'posts'} loaded
            {isFetchingMore && (
              <span className="text-gray-600 ml-1">
                (~{Math.round((postsLoaded / estimatedTotal) * 100)}% complete)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}