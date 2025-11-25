import {
  Check,
  Contrast,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Loader,
  Palette,
  RotateCcw,
  RotateCw,
  Sun,
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

// Filter presets with CSS filter values
const FILTER_PRESETS = {
  none: { name: "None", filter: "" },
  bw: { name: "B&W", filter: "grayscale(100%)" },
  sepia: { name: "Sepia", filter: "sepia(80%)" },
  vintage: {
    name: "Vintage",
    filter: "sepia(30%) contrast(110%) brightness(90%)",
  },
  warm: { name: "Warm", filter: "sepia(20%) saturate(120%)" },
  cool: { name: "Cool", filter: "saturate(80%) hue-rotate(20deg)" },
  dramatic: { name: "Dramatic", filter: "contrast(130%) saturate(120%)" },
  fade: {
    name: "Fade",
    filter: "contrast(90%) brightness(110%) saturate(80%)",
  },
  vivid: { name: "Vivid", filter: "saturate(150%) contrast(110%)" },
} as const;

type FilterPreset = keyof typeof FILTER_PRESETS;

// Aspect ratio presets
const ASPECT_RATIOS = {
  free: { name: "Free", ratio: null },
  "1:1": { name: "Square", ratio: 1 },
  "4:3": { name: "4:3", ratio: 4 / 3 },
  "3:4": { name: "3:4", ratio: 3 / 4 },
  "16:9": { name: "16:9", ratio: 16 / 9 },
  "9:16": { name: "9:16", ratio: 9 / 16 },
} as const;

type AspectRatioKey = keyof typeof ASPECT_RATIOS;

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  filter: FilterPreset;
}

interface EditedImage {
  originalFile: File;
  editedFile: File;
  preview: string;
  adjustments: ImageAdjustments;
  cropArea: CropArea | null;
}

interface ImageEditorProps {
  images: Array<{
    file: File;
    preview: string;
  }>;
  onSave: (editedImages: EditedImage[]) => void;
  onCancel: () => void;
}

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  filter: "none",
};

export function ImageEditor({ images, onSave, onCancel }: ImageEditorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedImages, setEditedImages] = useState<Map<number, EditedImage>>(
    () => new Map(),
  );
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    ...DEFAULT_ADJUSTMENTS,
  });
  const [isCropping, setIsCropping] = useState(false);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<AspectRatioKey>("free");
  const [activeTab, setActiveTab] = useState<"adjust" | "filters" | "crop">(
    "adjust",
  );
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<"move" | "resize" | null>(null);
  const resizeHandleRef = useRef<string | null>(null);

  const currentImage = images[currentIndex];

  // Load existing adjustments when switching images
  useEffect(() => {
    const existing = editedImages.get(currentIndex);
    if (existing) {
      setAdjustments(existing.adjustments);
      setCropArea(existing.cropArea);
    } else {
      setAdjustments({ ...DEFAULT_ADJUSTMENTS });
      setCropArea(null);
    }
    setIsCropping(false);
  }, [currentIndex, editedImages]);

  // Handle image load - keep for future use
  const handleImageLoad = useCallback(() => {
    // Image loaded, ready for editing
  }, []);

  // Calculate CSS filter string from adjustments
  const cssFilter = useMemo(() => {
    const parts: string[] = [];

    if (adjustments.brightness !== 0) {
      parts.push(`brightness(${100 + adjustments.brightness}%)`);
    }
    if (adjustments.contrast !== 0) {
      parts.push(`contrast(${100 + adjustments.contrast}%)`);
    }

    const presetFilter = FILTER_PRESETS[adjustments.filter].filter;
    if (presetFilter) {
      parts.push(presetFilter);
    }

    return parts.join(" ");
  }, [adjustments.brightness, adjustments.contrast, adjustments.filter]);

  // Calculate transform string from adjustments
  const cssTransform = useMemo(() => {
    const parts: string[] = [];

    if (adjustments.rotation !== 0) {
      parts.push(`rotate(${adjustments.rotation}deg)`);
    }
    if (adjustments.flipH) {
      parts.push("scaleX(-1)");
    }
    if (adjustments.flipV) {
      parts.push("scaleY(-1)");
    }

    return parts.join(" ");
  }, [adjustments.rotation, adjustments.flipH, adjustments.flipV]);

  // Rotate image
  const rotate = (direction: "cw" | "ccw") => {
    setAdjustments((prev) => ({
      ...prev,
      rotation:
        direction === "cw"
          ? (((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270)
          : (((prev.rotation - 90 + 360) % 360) as 0 | 90 | 180 | 270),
    }));
  };

  // Flip image
  const flip = (direction: "h" | "v") => {
    setAdjustments((prev) => ({
      ...prev,
      flipH: direction === "h" ? !prev.flipH : prev.flipH,
      flipV: direction === "v" ? !prev.flipV : prev.flipV,
    }));
  };

  // Reset adjustments
  const resetAdjustments = () => {
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    setCropArea(null);
    setIsCropping(false);
  };

  // Initialize crop area
  const initCrop = () => {
    if (!previewRef.current || !imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();

    // Start with full image
    let newCropArea: CropArea = {
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height,
    };

    // Apply aspect ratio if selected
    const aspectRatio = ASPECT_RATIOS[selectedAspectRatio].ratio;
    if (aspectRatio) {
      const imgAspect = rect.width / rect.height;
      if (imgAspect > aspectRatio) {
        // Image is wider - constrain by height
        const newWidth = rect.height * aspectRatio;
        newCropArea = {
          x: (rect.width - newWidth) / 2,
          y: 0,
          width: newWidth,
          height: rect.height,
        };
      } else {
        // Image is taller - constrain by width
        const newHeight = rect.width / aspectRatio;
        newCropArea = {
          x: 0,
          y: (rect.height - newHeight) / 2,
          width: rect.width,
          height: newHeight,
        };
      }
    }

    setCropArea(newCropArea);
    setIsCropping(true);
    setActiveTab("crop");
  };

  // Handle crop area mouse events
  const handleCropMouseDown = (e: React.MouseEvent, mode: string) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    cropStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
    isDraggingRef.current = true;

    if (mode === "move") {
      dragModeRef.current = "move";
    } else {
      dragModeRef.current = "resize";
      resizeHandleRef.current = mode;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cropStartRef.current || !cropArea) return;

      const dx = e.clientX - cropStartRef.current.x;
      const dy = e.clientY - cropStartRef.current.y;

      if (dragModeRef.current === "move") {
        setCropArea((prev) => {
          if (!prev || !rect) return prev;
          const newX = Math.max(
            0,
            Math.min(prev.x + dx, rect.width - prev.width),
          );
          const newY = Math.max(
            0,
            Math.min(prev.y + dy, rect.height - prev.height),
          );
          return { ...prev, x: newX, y: newY };
        });
      } else if (dragModeRef.current === "resize" && resizeHandleRef.current) {
        setCropArea((prev) => {
          if (!prev || !rect) return prev;

          let newArea = { ...prev };
          const handle = resizeHandleRef.current;
          const aspectRatio = ASPECT_RATIOS[selectedAspectRatio].ratio;

          // Handle resize based on which handle is being dragged
          if (handle?.includes("e")) {
            newArea.width = Math.max(
              50,
              Math.min(prev.width + dx, rect.width - prev.x),
            );
          }
          if (handle?.includes("w")) {
            const newWidth = Math.max(50, prev.width - dx);
            const newX = Math.max(0, prev.x + prev.width - newWidth);
            newArea.x = newX;
            newArea.width = prev.x + prev.width - newX;
          }
          if (handle?.includes("s")) {
            newArea.height = Math.max(
              50,
              Math.min(prev.height + dy, rect.height - prev.y),
            );
          }
          if (handle?.includes("n")) {
            const newHeight = Math.max(50, prev.height - dy);
            const newY = Math.max(0, prev.y + prev.height - newHeight);
            newArea.y = newY;
            newArea.height = prev.y + prev.height - newY;
          }

          // Maintain aspect ratio if set
          if (aspectRatio && handle) {
            if (handle.includes("e") || handle.includes("w")) {
              newArea.height = newArea.width / aspectRatio;
            } else {
              newArea.width = newArea.height * aspectRatio;
            }

            // Keep within bounds
            if (newArea.x + newArea.width > rect.width) {
              newArea.width = rect.width - newArea.x;
              newArea.height = newArea.width / aspectRatio;
            }
            if (newArea.y + newArea.height > rect.height) {
              newArea.height = rect.height - newArea.y;
              newArea.width = newArea.height * aspectRatio;
            }
          }

          return newArea;
        });
      }

      cropStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      cropStartRef.current = null;
      dragModeRef.current = null;
      resizeHandleRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Apply edits and export image
  const exportImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          reject(new Error("Canvas not available"));
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Calculate final dimensions based on rotation
        const isRotated90or270 =
          adjustments.rotation === 90 || adjustments.rotation === 270;
        let sourceWidth = img.width;
        let sourceHeight = img.height;

        // If cropped, calculate crop in original image coordinates
        let cropX = 0;
        let cropY = 0;
        let cropWidth = sourceWidth;
        let cropHeight = sourceHeight;

        if (cropArea && imageRef.current) {
          const displayRect = imageRef.current.getBoundingClientRect();
          const scaleX = img.width / displayRect.width;
          const scaleY = img.height / displayRect.height;

          cropX = cropArea.x * scaleX;
          cropY = cropArea.y * scaleY;
          cropWidth = cropArea.width * scaleX;
          cropHeight = cropArea.height * scaleY;
        }

        // Set canvas size based on crop and rotation
        if (isRotated90or270) {
          canvas.width = cropHeight;
          canvas.height = cropWidth;
        } else {
          canvas.width = cropWidth;
          canvas.height = cropHeight;
        }

        // Apply transformations
        ctx.save();

        // Move to center for rotation/flip
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Apply rotation
        if (adjustments.rotation !== 0) {
          ctx.rotate((adjustments.rotation * Math.PI) / 180);
        }

        // Apply flip
        const scaleX = adjustments.flipH ? -1 : 1;
        const scaleY = adjustments.flipV ? -1 : 1;
        ctx.scale(scaleX, scaleY);

        // Apply filters
        if (
          adjustments.brightness !== 0 ||
          adjustments.contrast !== 0 ||
          adjustments.filter !== "none"
        ) {
          ctx.filter = cssFilter;
        }

        // Draw image centered
        const drawWidth = isRotated90or270 ? cropHeight : cropWidth;
        const drawHeight = isRotated90or270 ? cropWidth : cropHeight;

        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight,
        );

        ctx.restore();

        // Export as JPEG or PNG based on original format
        const outputFormat =
          file.type === "image/png" ? "image/png" : "image/jpeg";
        const quality = outputFormat === "image/jpeg" ? 0.92 : undefined;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }

            const extension = outputFormat === "image/png" ? ".png" : ".jpg";
            const fileName = file.name.replace(
              /\.[^.]+$/,
              `_edited${extension}`,
            );

            resolve(new File([blob], fileName, { type: outputFormat }));
          },
          outputFormat,
          quality,
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  // Save current image edits
  const saveCurrentImage = async () => {
    try {
      const editedFile = await exportImage(currentImage.file);
      const preview = URL.createObjectURL(editedFile);

      const edited: EditedImage = {
        originalFile: currentImage.file,
        editedFile,
        preview,
        adjustments: { ...adjustments },
        cropArea: cropArea ? { ...cropArea } : null,
      };

      setEditedImages((prev) => {
        const newMap = new Map(prev);
        newMap.set(currentIndex, edited);
        return newMap;
      });

      return edited;
    } catch (error) {
      throw error;
    }
  };

  // Save all and close
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save current image if it has changes
      const hasChanges =
        adjustments.brightness !== 0 ||
        adjustments.contrast !== 0 ||
        adjustments.rotation !== 0 ||
        adjustments.flipH ||
        adjustments.flipV ||
        adjustments.filter !== "none" ||
        cropArea !== null;

      let finalEditedImages = new Map(editedImages);

      if (hasChanges && !editedImages.has(currentIndex)) {
        const edited = await saveCurrentImage();
        finalEditedImages.set(currentIndex, edited);
      }

      // Build final array of edited images
      const result: EditedImage[] = [];
      for (let i = 0; i < images.length; i++) {
        const edited = finalEditedImages.get(i);
        if (edited) {
          result.push(edited);
        } else {
          // Use original image unchanged
          result.push({
            originalFile: images[i].file,
            editedFile: images[i].file,
            preview: images[i].preview,
            adjustments: { ...DEFAULT_ADJUSTMENTS },
            cropArea: null,
          });
        }
      }

      onSave(result);
    } catch (error) {
      // Error handled silently
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate between images
  const goToImage = async (index: number) => {
    // Auto-save current if it has changes
    const hasChanges =
      adjustments.brightness !== 0 ||
      adjustments.contrast !== 0 ||
      adjustments.rotation !== 0 ||
      adjustments.flipH ||
      adjustments.flipV ||
      adjustments.filter !== "none" ||
      cropArea !== null;

    if (hasChanges && !editedImages.has(currentIndex)) {
      await saveCurrentImage();
    }

    setCurrentIndex(index);
  };

  // Apply aspect ratio to existing crop
  useEffect(() => {
    if (isCropping && cropArea && imageRef.current) {
      const aspectRatio = ASPECT_RATIOS[selectedAspectRatio].ratio;
      if (!aspectRatio) return;

      const rect = imageRef.current.getBoundingClientRect();
      const centerX = cropArea.x + cropArea.width / 2;
      const centerY = cropArea.y + cropArea.height / 2;

      let newWidth = cropArea.width;
      let newHeight = cropArea.width / aspectRatio;

      if (newHeight > rect.height) {
        newHeight = rect.height;
        newWidth = newHeight * aspectRatio;
      }

      const newX = Math.max(
        0,
        Math.min(centerX - newWidth / 2, rect.width - newWidth),
      );
      const newY = Math.max(
        0,
        Math.min(centerY - newHeight / 2, rect.height - newHeight),
      );

      setCropArea({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    }
  }, [selectedAspectRatio]);

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
              Edit Image{" "}
              {images.length > 1
                ? `(${currentIndex + 1}/${images.length})`
                : ""}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetAdjustments}
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
                <Loader size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {isSaving ? "Saving..." : "Done"}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main preview area */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gray-900 p-4">
            <div ref={previewRef} className="relative max-h-full max-w-full">
              <img
                ref={imageRef}
                src={currentImage.preview}
                alt="Preview"
                onLoad={handleImageLoad}
                className="max-h-[60vh] max-w-full object-contain"
                style={{
                  filter: cssFilter,
                  transform: cssTransform,
                }}
              />

              {/* Crop overlay */}
              {isCropping && cropArea && imageRef.current && (
                <div
                  className="absolute inset-0"
                  style={{
                    top: imageRef.current.offsetTop,
                    left: imageRef.current.offsetLeft,
                    width: imageRef.current.offsetWidth,
                    height: imageRef.current.offsetHeight,
                  }}
                >
                  {/* Dark overlay for non-cropped areas */}
                  <div className="absolute inset-0 bg-black/50" />

                  {/* Crop area with transparent background */}
                  <div
                    className="absolute cursor-move border-2 border-white"
                    style={{
                      left: cropArea.x,
                      top: cropArea.y,
                      width: cropArea.width,
                      height: cropArea.height,
                      backgroundColor: "transparent",
                      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                    }}
                    onMouseDown={(e) => handleCropMouseDown(e, "move")}
                  >
                    {/* Grid lines */}
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-1/3 top-0 h-full w-px bg-white/50" />
                      <div className="absolute left-2/3 top-0 h-full w-px bg-white/50" />
                      <div className="absolute left-0 top-1/3 h-px w-full bg-white/50" />
                      <div className="absolute left-0 top-2/3 h-px w-full bg-white/50" />
                    </div>

                    {/* Resize handles */}
                    {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((pos) => {
                      const isCorner = pos.length === 2;
                      const styles: React.CSSProperties = {
                        position: "absolute",
                        width: isCorner ? 16 : 8,
                        height: isCorner ? 16 : 8,
                        backgroundColor: "white",
                        borderRadius: isCorner ? "50%" : 2,
                      };

                      if (pos.includes("n")) styles.top = -4;
                      if (pos.includes("s")) styles.bottom = -4;
                      if (pos.includes("e")) styles.right = -4;
                      if (pos.includes("w")) styles.left = -4;
                      if (pos === "n" || pos === "s") {
                        styles.left = "50%";
                        styles.transform = "translateX(-50%)";
                        styles.width = 32;
                      }
                      if (pos === "e" || pos === "w") {
                        styles.top = "50%";
                        styles.transform = "translateY(-50%)";
                        styles.height = 32;
                      }

                      const cursors: Record<string, string> = {
                        nw: "nw-resize",
                        n: "n-resize",
                        ne: "ne-resize",
                        e: "e-resize",
                        se: "se-resize",
                        s: "s-resize",
                        sw: "sw-resize",
                        w: "w-resize",
                      };

                      return (
                        <div
                          key={pos}
                          style={{ ...styles, cursor: cursors[pos] }}
                          onMouseDown={(e) => handleCropMouseDown(e, pos)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden canvas for export */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Right sidebar - Controls */}
          <div
            className="flex w-80 flex-col border-l"
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
                { id: "adjust", label: "Adjust", icon: Sun },
                { id: "filters", label: "Filters", icon: Palette },
                { id: "crop", label: "Crop", icon: Crop },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
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
              {activeTab === "adjust" && (
                <div className="space-y-6">
                  {/* Brightness slider */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        className="flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        <Sun size={16} />
                        Brightness
                      </label>
                      <span
                        className="text-xs"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        {adjustments.brightness}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.brightness}
                      onChange={(e) =>
                        setAdjustments((prev) => ({
                          ...prev,
                          brightness: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Contrast slider */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        className="flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        <Contrast size={16} />
                        Contrast
                      </label>
                      <span
                        className="text-xs"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        {adjustments.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.contrast}
                      onChange={(e) =>
                        setAdjustments((prev) => ({
                          ...prev,
                          contrast: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Rotation controls */}
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      Rotate & Flip
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => rotate("ccw")}
                        className="flex-1 rounded-lg border p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        style={{
                          borderColor: "var(--bsky-border-primary)",
                          color: "var(--bsky-text-primary)",
                        }}
                        title="Rotate counter-clockwise"
                      >
                        <RotateCcw size={20} className="mx-auto" />
                      </button>
                      <button
                        onClick={() => rotate("cw")}
                        className="flex-1 rounded-lg border p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        style={{
                          borderColor: "var(--bsky-border-primary)",
                          color: "var(--bsky-text-primary)",
                        }}
                        title="Rotate clockwise"
                      >
                        <RotateCw size={20} className="mx-auto" />
                      </button>
                      <button
                        onClick={() => flip("h")}
                        className={`flex-1 rounded-lg border p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          adjustments.flipH
                            ? "bg-blue-100 dark:bg-blue-900"
                            : ""
                        }`}
                        style={{
                          borderColor: adjustments.flipH
                            ? "var(--bsky-primary)"
                            : "var(--bsky-border-primary)",
                          color: "var(--bsky-text-primary)",
                        }}
                        title="Flip horizontal"
                      >
                        <FlipHorizontal size={20} className="mx-auto" />
                      </button>
                      <button
                        onClick={() => flip("v")}
                        className={`flex-1 rounded-lg border p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          adjustments.flipV
                            ? "bg-blue-100 dark:bg-blue-900"
                            : ""
                        }`}
                        style={{
                          borderColor: adjustments.flipV
                            ? "var(--bsky-primary)"
                            : "var(--bsky-border-primary)",
                          color: "var(--bsky-text-primary)",
                        }}
                        title="Flip vertical"
                      >
                        <FlipVertical size={20} className="mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "filters" && (
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(FILTER_PRESETS).map(
                    ([key, { name, filter }]) => (
                      <button
                        key={key}
                        onClick={() =>
                          setAdjustments((prev) => ({
                            ...prev,
                            filter: key as FilterPreset,
                          }))
                        }
                        className={`relative overflow-hidden rounded-lg border transition-all ${
                          adjustments.filter === key
                            ? "ring-2 ring-offset-2"
                            : ""
                        }`}
                        style={{
                          borderColor:
                            adjustments.filter === key
                              ? "var(--bsky-primary)"
                              : "var(--bsky-border-primary)",
                        }}
                      >
                        <img
                          src={currentImage.preview}
                          alt={name}
                          className="aspect-square w-full object-cover"
                          style={{ filter }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-xs text-white">
                          {name}
                        </div>
                      </button>
                    ),
                  )}
                </div>
              )}

              {activeTab === "crop" && (
                <div className="space-y-4">
                  {/* Aspect ratio buttons */}
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(ASPECT_RATIOS).map(([key, { name }]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedAspectRatio(key as AspectRatioKey);
                            if (!isCropping) {
                              initCrop();
                            }
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                            selectedAspectRatio === key ? "font-medium" : ""
                          }`}
                          style={{
                            borderColor:
                              selectedAspectRatio === key
                                ? "var(--bsky-primary)"
                                : "var(--bsky-border-primary)",
                            backgroundColor:
                              selectedAspectRatio === key
                                ? "var(--bsky-primary)"
                                : "transparent",
                            color:
                              selectedAspectRatio === key
                                ? "white"
                                : "var(--bsky-text-primary)",
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Crop action buttons */}
                  <div className="flex gap-2">
                    {!isCropping ? (
                      <button
                        onClick={initCrop}
                        className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: "var(--bsky-primary)" }}
                      >
                        Start Crop
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setIsCropping(false);
                            setCropArea(null);
                          }}
                          className="flex-1 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          style={{
                            borderColor: "var(--bsky-border-primary)",
                            color: "var(--bsky-text-primary)",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setIsCropping(false)}
                          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                          style={{ backgroundColor: "var(--bsky-primary)" }}
                        >
                          Apply Crop
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Image thumbnails for batch editing */}
            {images.length > 1 && (
              <div
                className="border-t p-3"
                style={{ borderColor: "var(--bsky-border-primary)" }}
              >
                <div
                  className="mb-2 text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Images ({images.length})
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, index) => {
                    const isEdited = editedImages.has(index);
                    return (
                      <button
                        key={index}
                        onClick={() => goToImage(index)}
                        className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                          currentIndex === index
                            ? "ring-2 ring-offset-1"
                            : "opacity-70 hover:opacity-100"
                        }`}
                        style={{
                          borderColor:
                            currentIndex === index
                              ? "var(--bsky-primary)"
                              : "var(--bsky-border-primary)",
                        }}
                      >
                        <img
                          src={editedImages.get(index)?.preview || img.preview}
                          alt={`Image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {isEdited && (
                          <div className="absolute bottom-0.5 right-0.5 rounded-full bg-green-500 p-0.5">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
