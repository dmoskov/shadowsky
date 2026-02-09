import type Hls from "hls.js";
import {
  AlertCircle,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccessibility } from "../contexts/AccessibilityContext";
import { MediaCacheService } from "../services/media-cache-service";
import { createLogger } from "../utils/logger";

const logger = createLogger("VideoPlayer");

// Lazy load HLS.js only when needed for HLS streams
let HlsModule: typeof Hls | null = null;
async function getHls(): Promise<typeof Hls> {
  if (!HlsModule) {
    const module = await import("hls.js");
    HlsModule = module.default;
  }
  return HlsModule;
}

interface VideoPlayerProps {
  src: string;
  thumbnail?: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
  alt?: string;
  /** Whether this video is in a timeline/feed context (affects autoplay behavior) */
  inTimeline?: boolean;
  /** Enable caching of video for offline playback */
  enableCache?: boolean;
}

type VideoError = {
  code: number;
  message: string;
  recoverable: boolean;
};

const VIDEO_ERROR_MESSAGES: Record<number, VideoError> = {
  1: { code: 1, message: "Video loading aborted", recoverable: true },
  2: {
    code: 2,
    message: "Network error while loading video",
    recoverable: true,
  },
  3: { code: 3, message: "Video decoding failed", recoverable: false },
  4: { code: 4, message: "Video format not supported", recoverable: false },
};

export function VideoPlayer({
  src,
  thumbnail,
  aspectRatio,
  alt,
  inTimeline = false,
  enableCache = true,
}: VideoPlayerProps) {
  const { settings } = useAccessibility();
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState<VideoError | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isVisibleRef = useRef(false);

  const MAX_RETRIES = 3;

  // Determine autoplay behavior based on user preference and context
  const shouldAutoplay = useMemo(() => {
    if (!inTimeline) return false;
    return settings.videoAutoplay !== "off";
  }, [inTimeline, settings.videoAutoplay]);

  const shouldStartMuted = useMemo(() => {
    if (settings.videoAutoplay === "on") return false;
    return true; // Default muted for "muted" setting or when not autoplaying
  }, [settings.videoAutoplay]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Cache the video for offline playback
  useEffect(() => {
    if (!enableCache || !src || src.endsWith(".m3u8")) return;

    const cacheVideo = async () => {
      try {
        const mediaCache = MediaCacheService.getInstance();
        await mediaCache.init();
        const cached = await mediaCache.getOrCacheMedia(src);
        if (cached) {
          setCachedSrc(cached);
        }
      } catch (error) {
        logger.error("Failed to cache video:", error);
      }
    };

    cacheVideo();
  }, [src, enableCache]);

  // Handle viewport visibility for autoplay
  useEffect(() => {
    if (!shouldAutoplay || !containerRef.current) return;

    const handleVisibilityChange = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      isVisibleRef.current = entry.isIntersecting;

      if (entry.isIntersecting && !isVideoLoaded) {
        setIsVideoLoaded(true);
        setIsPlaying(true);
        setIsMuted(shouldStartMuted);
      } else if (!entry.isIntersecting && isPlaying && videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    observerRef.current = new IntersectionObserver(handleVisibilityChange, {
      threshold: 0.5, // 50% visible
      rootMargin: "0px",
    });

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [shouldAutoplay, shouldStartMuted, isVideoLoaded, isPlaying]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleLoadVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVideoLoaded(true);
    setIsPlaying(true);
    setIsMuted(shouldStartMuted);
  };

  const handlePlayPause = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (videoRef.current && !videoError) {
        try {
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            await videoRef.current.play();
          }
          setIsPlaying(!isPlaying);
        } catch (error) {
          logger.error("Video playback error:", error);
          setVideoError({
            code: 0,
            message: "Failed to play video",
            recoverable: true,
          });
        }
      }
    },
    [isPlaying, videoError],
  );

  const handleVideoError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      const errorCode = video.error?.code || 0;
      const errorInfo = VIDEO_ERROR_MESSAGES[errorCode] || {
        code: errorCode,
        message: video.error?.message || "Unknown video error",
        recoverable: true,
      };

      logger.error("Video error:", {
        error: video.error,
        src: video.src,
        readyState: video.readyState,
        networkState: video.networkState,
        errorInfo,
      });

      setVideoError(errorInfo);
      setIsLoading(false);
    },
    [],
  );

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      setVideoError({
        code: 0,
        message: "Maximum retry attempts reached",
        recoverable: false,
      });
      return;
    }

    setVideoError(null);
    setRetryCount((prev) => prev + 1);
    setIsLoading(true);

    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch((error) => {
        logger.error("Retry playback failed:", error);
        setVideoError({
          code: 0,
          message: "Failed to retry playback",
          recoverable: retryCount + 1 < MAX_RETRIES,
        });
      });
    }
  }, [retryCount]);

  useEffect(() => {
    if (!src || !videoRef.current || !isVideoLoaded) return;

    const videoSrc = cachedSrc || src;
    let hlsInstance: Hls | null = null;
    let isCancelled = false;
    let hlsManifestHandler: (() => void) | null = null;
    let hlsErrorHandler: ((event: string, data: any) => void) | null = null;
    let manifestParsedEvent: string | null = null;
    let errorEvent: string | null = null;

    // Check if this is an HLS stream
    if (src.endsWith(".m3u8")) {
      // Dynamically load HLS.js only when needed
      const initHls = async () => {
        try {
          const Hls = await getHls();

          if (isCancelled || !videoRef.current) return;

          if (Hls.isSupported()) {
            // Initialize HLS with bandwidth-adaptive streaming
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              // Bandwidth estimation settings
              abrEwmaDefaultEstimate: 500000, // 500kbps default
              abrEwmaFastLive: 3,
              abrEwmaSlowLive: 9,
              // Buffer settings
              maxBufferLength: 30,
              maxMaxBufferLength: 600,
              maxBufferSize: 60 * 1000 * 1000, // 60MB
              // Start with low quality and let ABR adjust
              startLevel: -1,
            });

            hlsInstance = hls;
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(videoRef.current);

            const handleManifestParsed = () => {
              setIsLoading(false);
              if (isPlaying) {
                videoRef.current?.play().catch((error) => {
                  logger.error("HLS autoplay failed:", error);
                  setIsPlaying(false);
                });
              }
            };

            const handleHlsError = (event: string, data: any) => {
              logger.error("HLS error:", event, data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (retryCount < MAX_RETRIES) {
                      logger.log("HLS network error, attempting recovery...");
                      hls.startLoad();
                      setRetryCount((prev) => prev + 1);
                    } else {
                      setVideoError({
                        code: 2,
                        message: "Network error loading video",
                        recoverable: false,
                      });
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    if (retryCount < MAX_RETRIES) {
                      logger.log("HLS media error, attempting recovery...");
                      hls.recoverMediaError();
                      setRetryCount((prev) => prev + 1);
                    } else {
                      setVideoError({
                        code: 3,
                        message: "Media error playing video",
                        recoverable: false,
                      });
                    }
                    break;
                  default:
                    setVideoError({
                      code: 0,
                      message: "Fatal error loading video",
                      recoverable: false,
                    });
                    hls.destroy();
                    break;
                }
              }
            };

            hlsManifestHandler = handleManifestParsed;
            hlsErrorHandler = handleHlsError;
            manifestParsedEvent = Hls.Events.MANIFEST_PARSED;
            errorEvent = Hls.Events.ERROR;
            hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
            hls.on(Hls.Events.ERROR, handleHlsError);
          } else if (
            videoRef.current.canPlayType("application/vnd.apple.mpegurl")
          ) {
            // Native HLS support (Safari)
            videoRef.current.src = src;
          } else {
            logger.error("HLS is not supported in this browser");
            setVideoError({
              code: 4,
              message: "HLS video not supported in this browser",
              recoverable: false,
            });
          }
        } catch (error) {
          logger.error("Failed to load HLS.js:", error);
          setVideoError({
            code: 0,
            message: "Failed to load video player",
            recoverable: true,
          });
        }
      };

      initHls();
    } else {
      // Regular video file - use cached version if available
      videoRef.current.src = videoSrc;
    }

    return () => {
      isCancelled = true;
      if (hlsInstance) {
        // Remove event listeners before destroying
        if (hlsManifestHandler && manifestParsedEvent) {
          hlsInstance.off(manifestParsedEvent as any, hlsManifestHandler);
        }
        if (hlsErrorHandler && errorEvent) {
          hlsInstance.off(errorEvent as any, hlsErrorHandler);
        }
        hlsInstance.destroy();
      }
    };
  }, [src, cachedSrc, isVideoLoaded, isPlaying, retryCount]);

  // Auto-play video after it's loaded on user click
  useEffect(() => {
    if (isVideoLoaded && videoRef.current && isPlaying) {
      const playVideo = async () => {
        try {
          videoRef.current!.muted = isMuted;
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
  }, [isVideoLoaded, isPlaying, isMuted]);

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
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleLoadStart = () => setIsLoading(true);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleStalled = () => {
      if (retryCount < MAX_RETRIES) {
        logger.log("Video stalled, attempting to recover...");
      }
    };

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("stalled", handleStalled);

    // Also check if metadata is already loaded
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("stalled", handleStalled);
    };
  }, [isVideoLoaded, retryCount]);

  // Keyboard controls
  useEffect(() => {
    if (!isVideoLoaded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if video is focused or in fullscreen
      if (!isFullscreen && document.activeElement !== containerRef.current)
        return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          handlePlayPause();
          break;
        case "m":
          e.preventDefault();
          handleMuteToggle();
          break;
        case "f":
          e.preventDefault();
          handleFullscreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(
              0,
              videoRef.current.currentTime - 5,
            );
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(
              duration,
              videoRef.current.currentTime + 5,
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.min(1, volume + 0.1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            setIsMuted(false);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.max(0, volume - 0.1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            if (newVol === 0) setIsMuted(true);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVideoLoaded, isFullscreen, duration, volume, handlePlayPause]);

  // Calculate aspect ratio for CLS prevention
  // Use CSS aspect-ratio property instead of padding-bottom for better CLS handling
  const videoAspectRatio = aspectRatio
    ? aspectRatio.width / aspectRatio.height
    : 16 / 9; // Default to 16:9

  // Container style with CSS aspect-ratio for CLS prevention
  const containerStyle: React.CSSProperties = {
    aspectRatio: videoAspectRatio,
  };

  // Error state with retry option
  const renderError = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
      <div className="max-w-xs p-4 text-center">
        <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
        <p className="mb-2 text-sm font-medium text-white">
          {videoError?.message || "Unable to load video"}
        </p>
        {videoError?.recoverable && retryCount < MAX_RETRIES && (
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
        {thumbnail && (
          <img
            src={thumbnail}
            alt={alt}
            className="mt-4 max-w-full rounded-lg opacity-50"
          />
        )}
      </div>
    </div>
  );

  // Show thumbnail with play button if video hasn't been loaded yet (and no autoplay)
  if (!isVideoLoaded && !shouldAutoplay) {
    return (
      <div
        ref={containerRef}
        className="media-placeholder-wrapper relative cursor-pointer overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
        style={containerStyle}
        data-aspect-ratio="true"
        onClick={handleLoadVideo}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        role="button"
        tabIndex={0}
        aria-label={alt ? `Play video: ${alt}` : "Play video"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsVideoLoaded(true);
            setIsPlaying(true);
            setIsMuted(shouldStartMuted);
          }
        }}
      >
        {/* Placeholder layer for CLS prevention */}
        <div
          className="placeholder-layer placeholder-animated absolute inset-0 bg-bsky-bg-tertiary"
          aria-hidden="true"
        />

        {thumbnail ? (
          <img
            src={thumbnail}
            alt={alt || "Video thumbnail"}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ position: "relative", zIndex: 1 }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700"
            style={{ zIndex: 1 }}
          >
            <span className="text-gray-500 dark:text-gray-400">Video</span>
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity hover:bg-opacity-40"
          style={{ zIndex: 2 }}
        >
          <div className="rounded-full bg-black bg-opacity-60 p-4 transition-transform hover:scale-110">
            <Play className="h-12 w-12 fill-white text-white" />
          </div>
        </div>
      </div>
    );
  }

  // Autoplay placeholder while waiting for visibility
  if (shouldAutoplay && !isVideoLoaded) {
    return (
      <div
        ref={containerRef}
        className="media-placeholder-wrapper relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
        style={containerStyle}
        data-aspect-ratio="true"
      >
        {/* Placeholder layer for CLS prevention */}
        <div
          className="placeholder-layer placeholder-animated absolute inset-0 bg-bsky-bg-tertiary"
          aria-hidden="true"
        />

        {thumbnail ? (
          <img
            src={thumbnail}
            alt={alt || "Video thumbnail"}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ position: "relative", zIndex: 1 }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700"
            style={{ zIndex: 1 }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="media-placeholder-wrapper relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
      style={containerStyle}
      data-aspect-ratio="true"
      data-loaded={isVideoLoaded ? "true" : "false"}
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
      tabIndex={0}
      role="application"
      aria-label={alt ? `Video player: ${alt}` : "Video player"}
    >
      {videoError ? (
        renderError()
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
            setDuration(video.duration);
          }}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            setCurrentTime(video.currentTime);
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
            }
          }}
          muted={isMuted}
          playsInline
          autoPlay={isVideoLoaded}
          aria-label={alt}
        />
      )}

      {/* Loading indicator */}
      {isLoading && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="rounded-full bg-black bg-opacity-50 p-4">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
          </div>
        </div>
      )}

      {/* Play/Pause overlay for initial state */}
      {!isPlaying && !isLoading && !videoError && (
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
      {showControls && !videoError && (
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
              role="slider"
              aria-label="Video progress"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={duration}
              tabIndex={0}
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
                    aria-label="Volume"
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
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-6 w-6" />
              ) : (
                <Maximize className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
