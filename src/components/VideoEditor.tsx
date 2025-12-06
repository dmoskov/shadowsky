import { fetchFile } from "@ffmpeg/util";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Italic,
  Loader,
  Palette,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { layoutMeasurementService } from "../services/layout-measurement-service";
import {
  generateVideoThumbnails,
  getVideoMetadata,
  loadFFmpegInstance,
  type VideoMetadata,
} from "../utils/video-compression";

// Video filter presets with CSS filter values (matching ImageEditor style)
const VIDEO_FILTER_PRESETS = {
  none: { name: "None", filter: "", ffmpegFilter: "" },
  bw: {
    name: "B&W",
    filter: "grayscale(100%)",
    ffmpegFilter: "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3",
  },
  sepia: {
    name: "Sepia",
    filter: "sepia(80%)",
    ffmpegFilter:
      "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131",
  },
  vintage: {
    name: "Vintage",
    filter: "sepia(30%) contrast(110%) brightness(90%)",
    ffmpegFilter: "curves=vintage",
  },
  warm: {
    name: "Warm",
    filter: "sepia(20%) saturate(120%)",
    ffmpegFilter: "colortemperature=temperature=6500",
  },
  cool: {
    name: "Cool",
    filter: "saturate(80%) hue-rotate(20deg)",
    ffmpegFilter: "colortemperature=temperature=8000",
  },
  dramatic: {
    name: "Dramatic",
    filter: "contrast(130%) saturate(120%)",
    ffmpegFilter: "eq=contrast=1.3:saturation=1.2",
  },
  fade: {
    name: "Fade",
    filter: "contrast(90%) brightness(110%) saturate(80%)",
    ffmpegFilter: "eq=contrast=0.9:brightness=0.05:saturation=0.8",
  },
  vivid: {
    name: "Vivid",
    filter: "saturate(150%) contrast(110%)",
    ffmpegFilter: "eq=saturation=1.5:contrast=1.1",
  },
  clarendon: {
    name: "Clarendon",
    filter: "contrast(120%) saturate(125%)",
    ffmpegFilter: "eq=contrast=1.2:saturation=1.25",
  },
  gingham: {
    name: "Gingham",
    filter: "brightness(105%) hue-rotate(-10deg)",
    ffmpegFilter: "eq=brightness=0.05,hue=h=-10",
  },
  moon: {
    name: "Moon",
    filter: "grayscale(100%) contrast(110%) brightness(110%)",
    ffmpegFilter:
      "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3,eq=contrast=1.1:brightness=0.05",
  },
} as const;

type VideoFilterPreset = keyof typeof VIDEO_FILTER_PRESETS;

// Playback speed options
const SPEED_OPTIONS = [
  { value: 0.5, label: "0.5x" },
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
] as const;

// Text overlay position presets
type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface TextOverlay {
  id: string;
  text: string;
  position: TextPosition;
  fontSize: number;
  color: string;
  backgroundColor: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
}

interface VideoEditorProps {
  video: {
    file: File;
    preview: string;
  };
  onSave: (editedVideo: {
    originalFile: File;
    editedFile: File;
    preview: string;
    trimStart: number;
    trimEnd: number;
    playbackSpeed: number;
    filter: VideoFilterPreset;
    textOverlays: TextOverlay[];
  }) => void;
  onCancel: () => void;
}

interface TrimState {
  start: number; // seconds
  end: number; // seconds
}

type EditorTab = "trim" | "speed" | "filters" | "text";

export function VideoEditor({ video, onSave, onCancel }: VideoEditorProps) {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [trim, setTrim] = useState<TrimState>({ start: 0, end: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for extended features
  const [activeTab, setActiveTab] = useState<EditorTab>("trim");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedFilter, setSelectedFilter] =
    useState<VideoFilterPreset>("none");
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<"start" | "end" | "playhead" | null>(null);

  // Calculate CSS filter string
  const cssFilter = useMemo(() => {
    return VIDEO_FILTER_PRESETS[selectedFilter].filter;
  }, [selectedFilter]);

  // Load video metadata and thumbnails
  useEffect(() => {
    const loadVideo = async () => {
      setIsLoading(true);
      try {
        const meta = await getVideoMetadata(video.file);
        setMetadata(meta);
        setTrim({ start: 0, end: meta.duration });

        // Generate thumbnails for timeline
        const thumbs = await generateVideoThumbnails(video.file, 10, 100);
        setThumbnails(thumbs.map((t) => URL.createObjectURL(t.blob)));
      } catch {
        setError("Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };
    loadVideo();

    return () => {
      thumbnails.forEach((t) => URL.revokeObjectURL(t));
    };
  }, [video.file]);

  // Apply playback speed to video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Sync video playback with trim
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !metadata) return;

    const handleTimeUpdate = () => {
      const time = videoEl.currentTime;
      setCurrentTime(time);

      // Stop at trim end
      if (time >= trim.end) {
        videoEl.pause();
        setIsPlaying(false);
        videoEl.currentTime = trim.start;
      }
    };

    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    return () => videoEl.removeEventListener("timeupdate", handleTimeUpdate);
  }, [metadata, trim.end, trim.start]);

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
    } else {
      if (videoEl.currentTime >= trim.end || videoEl.currentTime < trim.start) {
        videoEl.currentTime = trim.start;
      }
      videoEl.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, trim.start, trim.end]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle timeline interactions
  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    type: "start" | "end" | "playhead",
  ) => {
    e.preventDefault();
    isDraggingRef.current = type;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !timelineRef.current || !metadata) return;

      // Use sync measurement with caching for drag operations
      const rect = layoutMeasurementService.measureElementSync(
        timelineRef.current
      );
      if (!rect) return;

      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = (x / rect.width) * metadata.duration;

      // Round to 1-second precision
      const roundedTime = Math.round(time);

      if (isDraggingRef.current === "start") {
        setTrim((prev) => ({
          ...prev,
          start: Math.max(0, Math.min(roundedTime, prev.end - 1)),
        }));
      } else if (isDraggingRef.current === "end") {
        setTrim((prev) => ({
          ...prev,
          end: Math.min(
            metadata.duration,
            Math.max(roundedTime, prev.start + 1),
          ),
        }));
      } else if (isDraggingRef.current === "playhead") {
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.currentTime = Math.max(
            trim.start,
            Math.min(roundedTime, trim.end),
          );
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Adjust trim with buttons (1 second precision)
  const adjustTrim = (type: "start" | "end", direction: "left" | "right") => {
    if (!metadata) return;

    const delta = direction === "left" ? -1 : 1;

    setTrim((prev) => {
      if (type === "start") {
        const newStart = Math.max(
          0,
          Math.min(prev.start + delta, prev.end - 1),
        );
        return { ...prev, start: newStart };
      } else {
        const newEnd = Math.min(
          metadata.duration,
          Math.max(prev.end + delta, prev.start + 1),
        );
        return { ...prev, end: newEnd };
      }
    });
  };

  // Reset all edits
  const resetAll = () => {
    if (!metadata) return;
    setTrim({ start: 0, end: metadata.duration });
    setPlaybackSpeed(1);
    setSelectedFilter("none");
    setTextOverlays([]);
    setEditingTextId(null);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = 1;
    }
  };

  // Add new text overlay
  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      text: "Your text here",
      position: "bottom-center",
      fontSize: 24,
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.5)",
      bold: false,
      italic: false,
      align: "center",
    };
    setTextOverlays((prev) => [...prev, newOverlay]);
    setEditingTextId(newOverlay.id);
  };

  // Update text overlay
  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay,
      ),
    );
  };

  // Remove text overlay
  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    if (editingTextId === id) {
      setEditingTextId(null);
    }
  };

  // Get CSS position for text overlay
  const getTextOverlayStyle = (position: TextPosition): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      padding: "8px 16px",
      maxWidth: "80%",
    };

    switch (position) {
      case "top-left":
        return { ...baseStyle, top: "10%", left: "5%" };
      case "top-center":
        return {
          ...baseStyle,
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
        };
      case "top-right":
        return { ...baseStyle, top: "10%", right: "5%" };
      case "center":
        return {
          ...baseStyle,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        };
      case "bottom-left":
        return { ...baseStyle, bottom: "10%", left: "5%" };
      case "bottom-center":
        return {
          ...baseStyle,
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
        };
      case "bottom-right":
        return { ...baseStyle, bottom: "10%", right: "5%" };
      default:
        return baseStyle;
    }
  };

  // Check if any edits were made
  const hasEdits = useMemo(() => {
    if (!metadata) return false;
    return (
      trim.start !== 0 ||
      trim.end !== metadata.duration ||
      playbackSpeed !== 1 ||
      selectedFilter !== "none" ||
      textOverlays.length > 0
    );
  }, [metadata, trim, playbackSpeed, selectedFilter, textOverlays]);

  // Save edited video
  const handleSave = async () => {
    if (!metadata) return;

    // If no edits were made, return original
    if (!hasEdits) {
      onSave({
        originalFile: video.file,
        editedFile: video.file,
        preview: video.preview,
        trimStart: trim.start,
        trimEnd: trim.end,
        playbackSpeed,
        filter: selectedFilter,
        textOverlays,
      });
      return;
    }

    setIsSaving(true);
    setSaveProgress(0);
    setError(null);

    try {
      const ffmpeg = await loadFFmpegInstance();

      ffmpeg.on("progress", ({ progress }) => {
        setSaveProgress(Math.round(progress * 100));
      });

      // Write input file
      const inputData = await fetchFile(video.file);
      await ffmpeg.writeFile("input.mp4", inputData);

      setSaveProgress(10);

      // Build FFmpeg command
      const ffmpegArgs: string[] = ["-i", "input.mp4"];

      // Trim settings
      if (trim.start > 0) {
        ffmpegArgs.push("-ss", trim.start.toString());
      }
      const duration = trim.end - trim.start;
      ffmpegArgs.push("-t", duration.toString());

      // Build filter complex for effects
      const videoFilters: string[] = [];

      // Speed adjustment (using setpts for video, atempo for audio)
      if (playbackSpeed !== 1) {
        videoFilters.push(`setpts=${(1 / playbackSpeed).toFixed(4)}*PTS`);
      }

      // Color filter
      const ffmpegFilter = VIDEO_FILTER_PRESETS[selectedFilter].ffmpegFilter;
      if (ffmpegFilter) {
        videoFilters.push(ffmpegFilter);
      }

      // Text overlays using drawtext
      for (const overlay of textOverlays) {
        const escapedText = overlay.text
          .replace(/'/g, "\\'")
          .replace(/:/g, "\\:");

        // Calculate position based on overlay.position
        let x = "10";
        let y = "10";
        switch (overlay.position) {
          case "top-left":
            x = "10";
            y = "10";
            break;
          case "top-center":
            x = "(w-text_w)/2";
            y = "10";
            break;
          case "top-right":
            x = "w-text_w-10";
            y = "10";
            break;
          case "center":
            x = "(w-text_w)/2";
            y = "(h-text_h)/2";
            break;
          case "bottom-left":
            x = "10";
            y = "h-text_h-10";
            break;
          case "bottom-center":
            x = "(w-text_w)/2";
            y = "h-text_h-10";
            break;
          case "bottom-right":
            x = "w-text_w-10";
            y = "h-text_h-10";
            break;
        }

        videoFilters.push(
          `drawtext=text='${escapedText}':fontsize=${overlay.fontSize}:fontcolor=${overlay.color}:x=${x}:y=${y}:box=1:boxcolor=${overlay.backgroundColor.replace(/[()]/g, "")}:boxborderw=5`,
        );
      }

      // Apply video filters if any
      if (videoFilters.length > 0) {
        ffmpegArgs.push("-vf", videoFilters.join(","));
      }

      // Audio speed adjustment (if speed changed)
      if (playbackSpeed !== 1) {
        // atempo only supports 0.5 to 2.0, chain for extreme values
        const audioFilters: string[] = [];
        let speed = playbackSpeed;
        while (speed < 0.5) {
          audioFilters.push("atempo=0.5");
          speed *= 2;
        }
        while (speed > 2.0) {
          audioFilters.push("atempo=2.0");
          speed /= 2;
        }
        audioFilters.push(`atempo=${speed.toFixed(4)}`);
        ffmpegArgs.push("-af", audioFilters.join(","));
      }

      // Output settings
      ffmpegArgs.push(
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        "-y",
        "output.mp4",
      );

      // Execute FFmpeg
      await ffmpeg.exec(ffmpegArgs);

      setSaveProgress(90);

      // Read output
      const outputData = await ffmpeg.readFile("output.mp4");

      // Clean up
      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.mp4");

      // Create edited file
      const editedBlob = new Blob([outputData as BlobPart], {
        type: "video/mp4",
      });
      const editedFile = new File(
        [editedBlob],
        video.file.name.replace(/\.[^.]+$/, "_edited.mp4"),
        { type: "video/mp4" },
      );
      const preview = URL.createObjectURL(editedBlob);

      setSaveProgress(100);

      onSave({
        originalFile: video.file,
        editedFile,
        preview,
        trimStart: trim.start,
        trimEnd: trim.end,
        playbackSpeed,
        filter: selectedFilter,
        textOverlays,
      });
    } catch {
      setError("Failed to process video. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate trimmed duration
  const trimmedDuration = trim.end - trim.start;

  // Get currently editing text overlay
  const editingOverlay = textOverlays.find((o) => o.id === editingTextId);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div
          className="flex flex-col items-center gap-4 rounded-xl p-8"
          style={{ backgroundColor: "var(--bsky-bg-primary)" }}
        >
          <Loader size={40} className="animate-spin text-blue-500" />
          <span style={{ color: "var(--bsky-text-primary)" }}>
            Loading video...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--bsky-bg-primary)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              <X size={20} />
            </button>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Edit Video
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{
                borderColor: "var(--bsky-border-primary)",
                color: "var(--bsky-text-secondary)",
              }}
            >
              <Undo2 size={16} />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--bsky-primary)" }}
            >
              {isSaving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  {saveProgress}%
                </>
              ) : (
                <>
                  <Check size={16} />
                  Done
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main video preview area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div
              ref={videoContainerRef}
              className="relative flex flex-1 items-center justify-center overflow-hidden bg-gray-900 p-4"
            >
              <div className="relative">
                <video
                  ref={videoRef}
                  src={video.preview}
                  className="max-h-[45vh] max-w-full rounded-lg"
                  style={{ filter: cssFilter }}
                  onClick={togglePlay}
                />

                {/* Text overlays preview */}
                {textOverlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    style={{
                      ...getTextOverlayStyle(overlay.position),
                      fontSize: `${overlay.fontSize}px`,
                      color: overlay.color,
                      backgroundColor: overlay.backgroundColor,
                      fontWeight: overlay.bold ? "bold" : "normal",
                      fontStyle: overlay.italic ? "italic" : "normal",
                      textAlign: overlay.align,
                      borderRadius: "4px",
                      cursor: "pointer",
                      border:
                        editingTextId === overlay.id
                          ? "2px solid var(--bsky-primary)"
                          : "2px solid transparent",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTextId(overlay.id);
                      setActiveTab("text");
                    }}
                  >
                    {overlay.text}
                  </div>
                ))}

                {/* Play/Pause overlay */}
                <button
                  onClick={togglePlay}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-4 text-white transition-opacity hover:bg-black/70"
                >
                  {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                </button>
              </div>
            </div>

            {/* Timeline and controls */}
            <div
              className="border-t p-4"
              style={{ borderColor: "var(--bsky-border-primary)" }}
            >
              {/* Time display */}
              <div
                className="mb-3 flex items-center justify-between text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                <span>
                  Trim: {formatTime(trim.start)} - {formatTime(trim.end)}
                </span>
                <div className="flex items-center gap-4">
                  {playbackSpeed !== 1 && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {playbackSpeed}x speed
                    </span>
                  )}
                  {selectedFilter !== "none" && (
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      {VIDEO_FILTER_PRESETS[selectedFilter].name}
                    </span>
                  )}
                  <span>
                    Duration: {formatTime(trimmedDuration / playbackSpeed)} /{" "}
                    {formatTime(metadata?.duration || 0)}
                  </span>
                </div>
              </div>

              {/* Timeline with thumbnails */}
              <div
                ref={timelineRef}
                className="relative mb-4 h-16 cursor-pointer overflow-hidden rounded-lg"
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              >
                {/* Thumbnail strip */}
                <div className="absolute inset-0 flex">
                  {thumbnails.map((thumb, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${thumb})`,
                        filter: cssFilter,
                      }}
                    />
                  ))}
                </div>

                {/* Dimmed areas (outside trim) */}
                {metadata && (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-black/60"
                      style={{
                        width: `${(trim.start / metadata.duration) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-black/60"
                      style={{
                        width: `${((metadata.duration - trim.end) / metadata.duration) * 100}%`,
                      }}
                    />
                  </>
                )}

                {/* Trim handles */}
                {metadata && (
                  <>
                    {/* Start handle */}
                    <div
                      className="absolute inset-y-0 w-3 cursor-ew-resize bg-blue-500"
                      style={{
                        left: `calc(${(trim.start / metadata.duration) * 100}% - 6px)`,
                      }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, "start")}
                    >
                      <div className="flex h-full items-center justify-center">
                        <div className="h-6 w-0.5 rounded bg-white" />
                      </div>
                    </div>

                    {/* End handle */}
                    <div
                      className="absolute inset-y-0 w-3 cursor-ew-resize bg-blue-500"
                      style={{
                        left: `calc(${(trim.end / metadata.duration) * 100}% - 6px)`,
                      }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, "end")}
                    >
                      <div className="flex h-full items-center justify-center">
                        <div className="h-6 w-0.5 rounded bg-white" />
                      </div>
                    </div>

                    {/* Playhead */}
                    <div
                      className="absolute inset-y-0 w-0.5 cursor-ew-resize bg-white"
                      style={{
                        left: `${(currentTime / metadata.duration) * 100}%`,
                        boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                      }}
                      onMouseDown={(e) =>
                        handleTimelineMouseDown(e, "playhead")
                      }
                    >
                      <div
                        className="absolute -left-1.5 -top-1 h-3 w-3 rounded-full bg-white"
                        style={{ boxShadow: "0 0 4px rgba(0,0,0,0.5)" }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-center gap-6">
                {/* Start time controls */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Start
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustTrim("start", "left")}
                      disabled={trim.start <= 0}
                      className="rounded p-1 transition-colors hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span
                      className="w-12 text-center font-mono text-sm"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {formatTime(trim.start)}
                    </span>
                    <button
                      onClick={() => adjustTrim("start", "right")}
                      disabled={trim.start >= trim.end - 1}
                      className="rounded p-1 transition-colors hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Play button */}
                <button
                  onClick={togglePlay}
                  className="rounded-full p-3 text-white transition-transform hover:scale-110"
                  style={{ backgroundColor: "var(--bsky-primary)" }}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>

                {/* End time controls */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    End
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustTrim("end", "left")}
                      disabled={trim.end <= trim.start + 1}
                      className="rounded p-1 transition-colors hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span
                      className="w-12 text-center font-mono text-sm"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {formatTime(trim.end)}
                    </span>
                    <button
                      onClick={() => adjustTrim("end", "right")}
                      disabled={!metadata || trim.end >= metadata.duration}
                      className="rounded p-1 transition-colors hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="mt-3 rounded-lg bg-red-100 p-2 text-center text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar - Effect controls */}
          <div
            className="flex w-72 flex-col border-l"
            style={{
              borderColor: "var(--bsky-border-primary)",
              backgroundColor: "var(--bsky-bg-secondary)",
            }}
          >
            {/* Tabs */}
            <div
              className="flex border-b"
              style={{ borderColor: "var(--bsky-border-primary)" }}
            >
              {[
                { id: "trim" as const, label: "Trim", icon: Scissors },
                { id: "speed" as const, label: "Speed", icon: Gauge },
                { id: "filters" as const, label: "Filters", icon: Palette },
                { id: "text" as const, label: "Text", icon: Type },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === id
                      ? "border-b-2"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                  style={{
                    borderColor:
                      activeTab === id ? "var(--bsky-primary)" : "transparent",
                    color:
                      activeTab === id
                        ? "var(--bsky-primary)"
                        : "var(--bsky-text-secondary)",
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "trim" && (
                <div className="space-y-4">
                  <p
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Use the timeline below or the controls to set trim points.
                  </p>
                  <div
                    className="rounded-lg p-3"
                    style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
                  >
                    <div className="flex justify-between text-sm">
                      <span style={{ color: "var(--bsky-text-secondary)" }}>
                        Start:
                      </span>
                      <span
                        className="font-mono"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {formatTime(trim.start)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span style={{ color: "var(--bsky-text-secondary)" }}>
                        End:
                      </span>
                      <span
                        className="font-mono"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {formatTime(trim.end)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span style={{ color: "var(--bsky-text-secondary)" }}>
                        Duration:
                      </span>
                      <span
                        className="font-mono font-medium"
                        style={{ color: "var(--bsky-primary)" }}
                      >
                        {formatTime(trimmedDuration)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "speed" && (
                <div className="space-y-4">
                  <label
                    className="block text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    Playback Speed
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPEED_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setPlaybackSpeed(value)}
                        className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                          playbackSpeed === value
                            ? ""
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        style={{
                          borderColor:
                            playbackSpeed === value
                              ? "var(--bsky-primary)"
                              : "var(--bsky-border-primary)",
                          backgroundColor:
                            playbackSpeed === value
                              ? "var(--bsky-primary)"
                              : "transparent",
                          color:
                            playbackSpeed === value
                              ? "white"
                              : "var(--bsky-text-primary)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Adjust the playback speed. The final video duration will be{" "}
                    {formatTime(trimmedDuration / playbackSpeed)}.
                  </p>
                </div>
              )}

              {activeTab === "filters" && (
                <div className="space-y-4">
                  <label
                    className="block text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    Video Filters
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(VIDEO_FILTER_PRESETS).map(
                      ([key, { name, filter }]) => (
                        <button
                          key={key}
                          onClick={() =>
                            setSelectedFilter(key as VideoFilterPreset)
                          }
                          className={`relative overflow-hidden rounded-lg border transition-all ${
                            selectedFilter === key ? "ring-2 ring-offset-1" : ""
                          }`}
                          style={{
                            borderColor:
                              selectedFilter === key
                                ? "var(--bsky-primary)"
                                : "var(--bsky-border-primary)",
                          }}
                        >
                          {/* Use first thumbnail as preview */}
                          {thumbnails[0] ? (
                            <img
                              src={thumbnails[0]}
                              alt={name}
                              className="aspect-square w-full object-cover"
                              style={{ filter }}
                            />
                          ) : (
                            <div
                              className="aspect-square w-full"
                              style={{
                                backgroundColor: "var(--bsky-bg-tertiary)",
                                filter,
                              }}
                            />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-xs text-white">
                            {name}
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {activeTab === "text" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm font-medium"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      Text Overlays
                    </label>
                    <button
                      onClick={addTextOverlay}
                      className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white transition-colors"
                      style={{ backgroundColor: "var(--bsky-primary)" }}
                    >
                      <Plus size={14} />
                      Add Text
                    </button>
                  </div>

                  {textOverlays.length === 0 ? (
                    <p
                      className="text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      No text overlays added. Click "Add Text" to add one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {textOverlays.map((overlay) => (
                        <div
                          key={overlay.id}
                          className={`cursor-pointer rounded-lg border p-2 transition-colors ${
                            editingTextId === overlay.id
                              ? "ring-2"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                          style={{
                            borderColor:
                              editingTextId === overlay.id
                                ? "var(--bsky-primary)"
                                : "var(--bsky-border-primary)",
                          }}
                          onClick={() => setEditingTextId(overlay.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="truncate text-sm"
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              {overlay.text}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTextOverlay(overlay.id);
                              }}
                              className="rounded p-1 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text editing panel */}
                  {editingOverlay && (
                    <div
                      className="space-y-3 rounded-lg border p-3"
                      style={{ borderColor: "var(--bsky-border-primary)" }}
                    >
                      <h4
                        className="text-xs font-semibold uppercase"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        Edit Text
                      </h4>

                      {/* Text input */}
                      <input
                        type="text"
                        value={editingOverlay.text}
                        onChange={(e) =>
                          updateTextOverlay(editingOverlay.id, {
                            text: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{
                          borderColor: "var(--bsky-border-primary)",
                          backgroundColor: "var(--bsky-bg-primary)",
                          color: "var(--bsky-text-primary)",
                        }}
                        placeholder="Enter text..."
                      />

                      {/* Position */}
                      <div>
                        <label
                          className="mb-1 block text-xs"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          Position
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              "top-left",
                              "top-center",
                              "top-right",
                              "bottom-left",
                              "bottom-center",
                              "bottom-right",
                            ] as TextPosition[]
                          ).map((pos) => (
                            <button
                              key={pos}
                              onClick={() =>
                                updateTextOverlay(editingOverlay.id, {
                                  position: pos,
                                })
                              }
                              className={`rounded border px-2 py-1 text-xs capitalize transition-colors ${
                                editingOverlay.position === pos
                                  ? "font-medium"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                              style={{
                                borderColor:
                                  editingOverlay.position === pos
                                    ? "var(--bsky-primary)"
                                    : "var(--bsky-border-primary)",
                                backgroundColor:
                                  editingOverlay.position === pos
                                    ? "var(--bsky-primary)"
                                    : "transparent",
                                color:
                                  editingOverlay.position === pos
                                    ? "white"
                                    : "var(--bsky-text-primary)",
                              }}
                            >
                              {pos.replace("-", " ")}
                            </button>
                          ))}
                          <button
                            onClick={() =>
                              updateTextOverlay(editingOverlay.id, {
                                position: "center",
                              })
                            }
                            className={`col-span-3 rounded border px-2 py-1 text-xs transition-colors ${
                              editingOverlay.position === "center"
                                ? "font-medium"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                            style={{
                              borderColor:
                                editingOverlay.position === "center"
                                  ? "var(--bsky-primary)"
                                  : "var(--bsky-border-primary)",
                              backgroundColor:
                                editingOverlay.position === "center"
                                  ? "var(--bsky-primary)"
                                  : "transparent",
                              color:
                                editingOverlay.position === "center"
                                  ? "white"
                                  : "var(--bsky-text-primary)",
                            }}
                          >
                            Center
                          </button>
                        </div>
                      </div>

                      {/* Font size */}
                      <div>
                        <label
                          className="mb-1 block text-xs"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          Font Size: {editingOverlay.fontSize}px
                        </label>
                        <input
                          type="range"
                          min="12"
                          max="72"
                          value={editingOverlay.fontSize}
                          onChange={(e) =>
                            updateTextOverlay(editingOverlay.id, {
                              fontSize: Number(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>

                      {/* Style buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateTextOverlay(editingOverlay.id, {
                              bold: !editingOverlay.bold,
                            })
                          }
                          className={`flex-1 rounded border p-2 transition-colors ${
                            editingOverlay.bold
                              ? "bg-blue-100 dark:bg-blue-900/50"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                          style={{
                            borderColor: editingOverlay.bold
                              ? "var(--bsky-primary)"
                              : "var(--bsky-border-primary)",
                            color: "var(--bsky-text-primary)",
                          }}
                        >
                          <Bold size={16} className="mx-auto" />
                        </button>
                        <button
                          onClick={() =>
                            updateTextOverlay(editingOverlay.id, {
                              italic: !editingOverlay.italic,
                            })
                          }
                          className={`flex-1 rounded border p-2 transition-colors ${
                            editingOverlay.italic
                              ? "bg-blue-100 dark:bg-blue-900/50"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                          style={{
                            borderColor: editingOverlay.italic
                              ? "var(--bsky-primary)"
                              : "var(--bsky-border-primary)",
                            color: "var(--bsky-text-primary)",
                          }}
                        >
                          <Italic size={16} className="mx-auto" />
                        </button>
                        {(["left", "center", "right"] as const).map((align) => {
                          const Icon =
                            align === "left"
                              ? AlignLeft
                              : align === "center"
                                ? AlignCenter
                                : AlignRight;
                          return (
                            <button
                              key={align}
                              onClick={() =>
                                updateTextOverlay(editingOverlay.id, { align })
                              }
                              className={`flex-1 rounded border p-2 transition-colors ${
                                editingOverlay.align === align
                                  ? "bg-blue-100 dark:bg-blue-900/50"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                              style={{
                                borderColor:
                                  editingOverlay.align === align
                                    ? "var(--bsky-primary)"
                                    : "var(--bsky-border-primary)",
                                color: "var(--bsky-text-primary)",
                              }}
                            >
                              <Icon size={16} className="mx-auto" />
                            </button>
                          );
                        })}
                      </div>

                      {/* Colors */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label
                            className="mb-1 block text-xs"
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            Text Color
                          </label>
                          <input
                            type="color"
                            value={editingOverlay.color}
                            onChange={(e) =>
                              updateTextOverlay(editingOverlay.id, {
                                color: e.target.value,
                              })
                            }
                            className="h-8 w-full cursor-pointer rounded"
                          />
                        </div>
                        <div className="flex-1">
                          <label
                            className="mb-1 block text-xs"
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            Background
                          </label>
                          <div className="flex gap-1">
                            {[
                              "rgba(0,0,0,0.5)",
                              "rgba(0,0,0,0.8)",
                              "rgba(255,255,255,0.5)",
                              "transparent",
                            ].map((bg) => (
                              <button
                                key={bg}
                                onClick={() =>
                                  updateTextOverlay(editingOverlay.id, {
                                    backgroundColor: bg,
                                  })
                                }
                                className={`h-8 flex-1 rounded border ${
                                  editingOverlay.backgroundColor === bg
                                    ? "ring-2 ring-blue-500"
                                    : ""
                                }`}
                                style={{
                                  backgroundColor:
                                    bg === "transparent" ? "transparent" : bg,
                                  borderColor: "var(--bsky-border-primary)",
                                }}
                                title={
                                  bg === "transparent"
                                    ? "No background"
                                    : bg.includes("0,0,0")
                                      ? "Dark"
                                      : "Light"
                                }
                              >
                                {bg === "transparent" && (
                                  <X
                                    size={14}
                                    className="mx-auto text-gray-400"
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
