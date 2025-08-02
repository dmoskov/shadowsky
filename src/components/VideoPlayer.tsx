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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSeeking, setIsSeeking] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const newTime = pos * duration
    
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleSeekStart = () => {
    setIsSeeking(true)
  }

  const handleSeekEnd = () => {
    setIsSeeking(false)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }

  const handleMuteToggle = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.muted = false
        videoRef.current.volume = volume > 0 ? volume : 1
        setIsMuted(false)
        if (volume === 0) setVolume(1)
      } else {
        videoRef.current.muted = true
        setIsMuted(true)
      }
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

  // Handle controls auto-hide
  useEffect(() => {
    if (showControls && isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isSeeking) {
          setShowControls(false)
        }
      }, 3000)
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [showControls, isPlaying, isSeeking])

  // Update time and buffer progress
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => {
      setCurrentTime(video.currentTime)
      
      // Update buffered amount
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        const bufferedAmount = (bufferedEnd / video.duration) * 100
        setBuffered(bufferedAmount)
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }

    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [])

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
      onMouseMove={() => {
        setShowControls(true)
        if (controlsTimeoutRef.current && isPlaying) {
          clearTimeout(controlsTimeoutRef.current)
          controlsTimeoutRef.current = setTimeout(() => {
            if (!isSeeking) {
              setShowControls(false)
            }
          }, 3000)
        }
      }}
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
      
      {/* Loading indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-black bg-opacity-50 rounded-full p-4">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Play/Pause overlay for initial state */}
      {!isPlaying && !isLoading && !hasError && (
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
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          {/* Progress bar */}
          <div className="px-4 pb-2">
            <div 
              ref={progressBarRef}
              className="relative h-1 bg-white/20 rounded-full cursor-pointer group"
              onClick={handleSeek}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
            >
              {/* Buffered progress */}
              <div 
                className="absolute h-full bg-white/30 rounded-full"
                style={{ width: `${buffered}%` }}
              />
              
              {/* Played progress */}
              <div 
                className="absolute h-full bg-blue-500 rounded-full group-hover:h-1.5 transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              
              {/* Scrubber handle */}
              <div 
                className="absolute w-3 h-3 bg-white rounded-full -top-1 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex items-center space-x-3">
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
              
              {/* Volume controls */}
              <div className="flex items-center space-x-2 group">
                <button
                  onClick={handleMuteToggle}
                  className="text-white hover:text-gray-300 transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-6 h-6" />
                  ) : (
                    <Volume2 className="w-6 h-6" />
                  )}
                </button>
                
                {/* Volume slider */}
                <div className="w-0 group-hover:w-20 overflow-hidden transition-all duration-200">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
              </div>

              {/* Time display */}
              <div className="text-white text-sm">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
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