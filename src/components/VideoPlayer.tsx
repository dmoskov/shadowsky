import Hls from "hls.js";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createLogger } from "../utils/logger";

const logger = createLogger("VideoPlayer");

interface VideoPlayerProps {
  src: string;
  thumbnail?: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
  alt?: string;
}

export function VideoPlayer({
  src,
  thumbnail,
  aspectRatio,
  alt,
}: VideoPlayerProps) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [showControls, setShowControls] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLoadVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVideoLoaded(true);
    // Video will auto-play after loading
    setIsPlaying(true);
  };

  const handlePlayPause = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current && !hasError) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          await videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
        logger.error("Video playback error:", error);
        setHasError(true);
      }
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    logger.error("Video error:", {
      error: video.error,
      src: video.src,
      readyState: video.readyState,
      networkState: video.networkState,
    });
    setHasError(true);
  };

  useEffect(() => {
    if (!src || !videoRef.current || !isVideoLoaded) return;

    // Check if this is an HLS stream
    if (src.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        // Initialize HLS
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });

        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.ERROR, (event, data) => {
          logger.error("HLS error:", event, data);
          if (data.fatal) {
            setHasError(true);
          }
        });

        return () => {
          hls.destroy();
        };
      } else if (
        videoRef.current.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Native HLS support (Safari)
        videoRef.current.src = src;
      } else {
        logger.error("HLS is not supported in this browser");
        setHasError(true);
      }
    } else {
      // Regular video file
      videoRef.current.src = src;
    }
  }, [src, isVideoLoaded]);

  // Auto-play video after it's loaded on user click
  useEffect(() => {
    if (isVideoLoaded && videoRef.current && isPlaying) {
      const playVideo = async () => {
        try {
          await videoRef.current?.play();
        } catch (error) {
          logger.error("Failed to auto-play video:", error);
          setIsPlaying(false);
        }
      };

      // Small delay to ensure video is ready
      const timer = setTimeout(playVideo, 100);
      return () => clearTimeout(timer);
    }
  }, [isVideoLoaded, isPlaying]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.muted = false;
        videoRef.current.volume = volume > 0 ? volume : 1;
        setIsMuted(false);
        if (volume === 0) setVolume(1);
      } else {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  // Handle controls auto-hide
  useEffect(() => {
    if (showControls && isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isSeeking) {
          setShowControls(false);
        }
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying, isSeeking]);

  // Update time and buffer progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);

      // Update buffered amount
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedAmount = (bufferedEnd / video.duration) * 100;
        setBuffered(bufferedAmount);
      }
    };

    const handleLoadedMetadata = () => {
      logger.log("Video metadata loaded, duration:", video.duration);
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);

    // Also check if metadata is already loaded
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [isVideoLoaded]);

  const paddingBottom = aspectRatio
    ? `${(aspectRatio.height / aspectRatio.width) * 100}%`
    : "56.25%"; // Default to 16:9

  // Show thumbnail with play button if video hasn't been loaded yet
  if (!isVideoLoaded) {
    return (
      <div
        className="relative cursor-pointer overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
        style={{ paddingBottom }}
        onClick={handleLoadVideo}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <span className="text-gray-500 dark:text-gray-400">Video</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity hover:bg-opacity-40">
          <div className="rounded-full bg-black bg-opacity-60 p-4 transition-transform hover:scale-110">
            <Play className="h-12 w-12 fill-white text-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
      style={{ paddingBottom }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(!isPlaying)}
      onMouseMove={() => {
        setShowControls(true);
        if (controlsTimeoutRef.current && isPlaying) {
          clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => {
            if (!isSeeking) {
              setShowControls(false);
            }
          }, 3000);
        }
      }}
    >
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Unable to load video
            </p>
            {thumbnail && (
              <img
                src={thumbnail}
                alt={alt}
                className="mt-2 max-w-full rounded-lg"
              />
            )}
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          poster={thumbnail}
          className="absolute inset-0 h-full w-full object-contain"
          onClick={handlePlayPause}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={handleVideoError}
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            logger.log("onLoadedMetadata event, duration:", video.duration);
            setDuration(video.duration);
          }}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            setCurrentTime(video.currentTime);
          }}
          muted={isMuted}
          playsInline
          autoPlay={isVideoLoaded}
          aria-label={alt}
        />
      )}

      {/* Loading indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="rounded-full bg-black bg-opacity-50 p-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        </div>
      )}

      {/* Play/Pause overlay for initial state */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black bg-opacity-30"
          onClick={handlePlayPause}
        >
          <div className="rounded-full bg-black bg-opacity-50 p-4">
            <Play className="h-12 w-12 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Control bar */}
      {showControls && !hasError && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div className="px-4 pb-2">
            <div
              ref={progressBarRef}
              className="group relative h-1 cursor-pointer rounded-full bg-white/20"
              onClick={handleSeek}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
            >
              {/* Buffered progress */}
              <div
                className="absolute h-full rounded-full bg-white/30"
                style={{ width: `${buffered}%` }}
              />

              {/* Played progress */}
              <div
                className="absolute h-full rounded-full bg-blue-500 transition-all group-hover:h-1.5"
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                }}
              />

              {/* Scrubber handle */}
              <div
                className="absolute -top-1 h-3 w-3 -translate-x-1/2 transform rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePlayPause}
                className="text-white transition-colors hover:text-gray-300"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 fill-white" />
                )}
              </button>

              {/* Volume controls */}
              <div className="group relative flex items-center">
                <button
                  onClick={handleMuteToggle}
                  className="text-white transition-colors hover:text-gray-300"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-6 w-6" />
                  ) : (
                    <Volume2 className="h-6 w-6" />
                  )}
                </button>

                {/* Volume slider - positioned absolutely to prevent layout shift */}
                <div
                  className="absolute left-full ml-2 w-20 origin-left scale-x-0 opacity-0 transition-all duration-200 group-hover:scale-x-100 group-hover:opacity-100"
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Time display */}
              <div className="text-sm text-white">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <button
              onClick={handleFullscreen}
              className="text-white transition-colors hover:text-gray-300"
              aria-label="Fullscreen"
            >
              <Maximize className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
