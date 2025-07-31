import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react'
import Hls from 'hls.js'

interface VideoPlayerProps {
  src: string
  thumbnail?: string
  aspectRatio?: {
    width: number
    height: number
  }
  alt?: string
}

export function VideoPlayer({ src, thumbnail, aspectRatio, alt }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true) // Start muted for autoplay
  const [showControls, setShowControls] = useState(true)
  const [hasError, setHasError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const handlePlayPause = async () => {
    if (videoRef.current && !hasError) {
      try {
        if (isPlaying) {
          videoRef.current.pause()
        } else {
          await videoRef.current.play()
        }
        setIsPlaying(!isPlaying)
      } catch (error) {
        console.error('Video playback error:', error)
        setHasError(true)
      }
    }
  }
  
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    console.error('Video error:', {
      error: video.error,
      src: video.src,
      readyState: video.readyState,
      networkState: video.networkState
    })
    setHasError(true)
  }
  
  useEffect(() => {
    if (!src || !videoRef.current) return
    
    // Check if this is an HLS stream
    if (src.endsWith('.m3u8')) {
      if (Hls.isSupported()) {
        // Initialize HLS
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        })
        
        hlsRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(videoRef.current)
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', event, data)
          if (data.fatal) {
            setHasError(true)
          }
        })
        
        return () => {
          hls.destroy()
        }
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoRef.current.src = src
      } else {
        console.error('HLS is not supported in this browser')
        setHasError(true)
      }
    } else {
      // Regular video file
      videoRef.current.src = src
    }
  }, [src])

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        containerRef.current.requestFullscreen()
      }
    }
  }

  const paddingBottom = aspectRatio 
    ? `${(aspectRatio.height / aspectRatio.width) * 100}%` 
    : '56.25%' // Default to 16:9

  return (
    <div 
      ref={containerRef}
      className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
      style={{ paddingBottom }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(!isPlaying)}
    >
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400">Unable to load video</p>
            {thumbnail && (
              <img 
                src={thumbnail} 
                alt={alt} 
                className="mt-2 rounded-lg max-w-full"
              />
            )}
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          poster={thumbnail}
          className="absolute inset-0 w-full h-full object-contain"
          onClick={handlePlayPause}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={handleVideoError}
          muted={isMuted}
          playsInline
          aria-label={alt}
        />
      )}
      
      {/* Play/Pause overlay for initial state */}
      {!isPlaying && !hasError && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 cursor-pointer"
          onClick={handlePlayPause}
        >
          <div className="bg-black bg-opacity-50 rounded-full p-4">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}
      
      {/* Control bar */}
      {showControls && !hasError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 fill-white" />
                )}
              </button>
              
              <button
                onClick={handleMuteToggle}
                className="text-white hover:text-gray-300 transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>
            </div>
            
            <button
              onClick={handleFullscreen}
              className="text-white hover:text-gray-300 transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}