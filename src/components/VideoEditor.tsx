import { fetchFile } from "@ffmpeg/util";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader,
  Pause,
  Play,
  Scissors,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateVideoThumbnails,
  getVideoMetadata,
  loadFFmpegInstance,
  type VideoMetadata,
} from "../utils/video-compression";

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
  }) => void;
  onCancel: () => void;
}

interface TrimState {
  start: number; // seconds
  end: number; // seconds
}

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<"start" | "end" | "playhead" | null>(null);

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
      } catch (err) {
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

      const rect = timelineRef.current.getBoundingClientRect();
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

  // Reset trim
  const resetTrim = () => {
    if (!metadata) return;
    setTrim({ start: 0, end: metadata.duration });
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Save trimmed video
  const handleSave = async () => {
    if (!metadata) return;

    // If no trimming was done, return original
    if (trim.start === 0 && trim.end === metadata.duration) {
      onSave({
        originalFile: video.file,
        editedFile: video.file,
        preview: video.preview,
        trimStart: trim.start,
        trimEnd: trim.end,
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

      // Calculate duration
      const duration = trim.end - trim.start;

      // Execute trim command
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-ss",
        trim.start.toString(),
        "-t",
        duration.toString(),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        "-y",
        "output.mp4",
      ]);

      setSaveProgress(90);

      // Read output
      const outputData = await ffmpeg.readFile("output.mp4");

      // Clean up
      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.mp4");

      // Create trimmed file
      const trimmedBlob = new Blob([outputData as any], { type: "video/mp4" });
      const trimmedFile = new File(
        [trimmedBlob],
        video.file.name.replace(/\.[^.]+$/, "_trimmed.mp4"),
        { type: "video/mp4" },
      );
      const preview = URL.createObjectURL(trimmedBlob);

      setSaveProgress(100);

      onSave({
        originalFile: video.file,
        editedFile: trimmedFile,
        preview,
        trimStart: trim.start,
        trimEnd: trim.end,
      });
    } catch (err) {
      setError("Failed to trim video. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate trimmed duration
  const trimmedDuration = trim.end - trim.start;

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
        className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl"
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
              <Scissors size={20} className="mr-2 inline" />
              Trim Video
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetTrim}
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

        {/* Video preview */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gray-900 p-4">
          <video
            ref={videoRef}
            src={video.preview}
            className="max-h-[50vh] max-w-full rounded-lg"
            onClick={togglePlay}
          />

          {/* Play/Pause overlay */}
          <button
            onClick={togglePlay}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-4 text-white transition-opacity hover:bg-black/70"
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} />}
          </button>
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
            <span>
              Duration: {formatTime(trimmedDuration)} /{" "}
              {formatTime(metadata?.duration || 0)}
            </span>
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
                  style={{ backgroundImage: `url(${thumb})` }}
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
                  onMouseDown={(e) => handleTimelineMouseDown(e, "playhead")}
                >
                  <div
                    className="absolute -left-1.5 -top-1 h-3 w-3 rounded-full bg-white"
                    style={{ boxShadow: "0 0 4px rgba(0,0,0,0.5)" }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Fine-tune controls */}
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
    </div>
  );
}
