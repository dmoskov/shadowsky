/**
 * ComposerToolbar - Orchestrates section visibility with progressive disclosure
 * Controls which features are visible based on disclosure level
 */

import {
  ChevronDown,
  ChevronUp,
  Image,
  MessageSquare,
  Plus,
  Smile,
  Video,
  Wand2,
} from "lucide-react";
import React, { useState } from "react";
import type { DisclosureLevel, UploadedMedia } from "./types";

interface ComposerToolbarProps {
  // Feature flags
  enableProgressiveDisclosure: boolean;
  defaultDisclosureLevel: DisclosureLevel;

  // State
  isPosting: boolean;
  media: UploadedMedia[];
  selectedTone: string | null;
  isAdjustingTone: boolean;
  isLoadingFeedback: boolean;
  text: string;
  hasGif?: boolean;

  // Video upload state
  isVideoUploading: boolean;

  // Handlers
  onInsertThreadSplit: () => void;
  onAddImages: () => void;
  onAddVideo: () => void;
  onOpenGiphy: () => void;
  onOpenEmoji: () => void;
  onToggleToneOptions: () => void;
  onRequestFeedback: () => void;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Children for expanded sections
  children?: React.ReactNode;
}

export const ComposerToolbar: React.FC<ComposerToolbarProps> = ({
  enableProgressiveDisclosure,
  defaultDisclosureLevel,
  isPosting,
  media,
  selectedTone,
  isAdjustingTone,
  isLoadingFeedback,
  text,
  hasGif = false,
  isVideoUploading,
  onInsertThreadSplit,
  onAddImages,
  onAddVideo,
  onOpenGiphy,
  onOpenEmoji,
  onToggleToneOptions,
  onRequestFeedback,
  fileInputRef,
  onFileInputChange,
}) => {
  const [disclosureLevel, setDisclosureLevel] = useState<DisclosureLevel>(
    defaultDisclosureLevel,
  );

  const MAX_IMAGES_PER_POST = 4;
  const hasVideo = media.some((m) => m.type === "video");
  const imageCount = media.filter((m) => m.type === "image").length;

  // Determine which sections to show based on disclosure level
  const showStandardFeatures =
    !enableProgressiveDisclosure ||
    disclosureLevel === "standard" ||
    disclosureLevel === "advanced";
  const showAdvancedFeatures =
    !enableProgressiveDisclosure || disclosureLevel === "advanced";

  const toggleDisclosure = () => {
    if (disclosureLevel === "primary") {
      setDisclosureLevel("standard");
    } else if (disclosureLevel === "standard") {
      setDisclosureLevel("advanced");
    } else {
      setDisclosureLevel("primary");
    }
  };

  const getDisclosureLevelLabel = () => {
    switch (disclosureLevel) {
      case "primary":
        return "Basic";
      case "standard":
        return "Standard";
      case "advanced":
        return "Advanced";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Primary toolbar - always visible */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {/* Thread split button */}
          <ToolbarButton
            icon={<Plus size={20} />}
            onClick={onInsertThreadSplit}
            disabled={isPosting}
            label="Insert thread split"
            tooltip={{
              title: "Split Thread Here",
              description: "Insert manual break (---)",
              detail: "Forces a new post at cursor",
            }}
          />

          {/* Add images button */}
          <ToolbarButton
            icon={<Image size={20} />}
            onClick={onAddImages}
            disabled={
              isPosting ||
              imageCount >= MAX_IMAGES_PER_POST ||
              hasVideo ||
              isVideoUploading ||
              hasGif
            }
            label="Add images"
            badge={imageCount > 0 ? imageCount : undefined}
            tooltip={{
              title: "Add Images",
              description: "Up to 4 images, max 1MB each",
              detail: "Tip: You can paste images from clipboard!",
            }}
          />

          {/* Add video button */}
          <ToolbarButton
            icon={<Video size={20} />}
            onClick={onAddVideo}
            disabled={
              isPosting || media.length > 0 || isVideoUploading || hasGif
            }
            label="Add video"
            badge={hasVideo ? 1 : undefined}
            tooltip={{
              title: "Add Video",
              description: "1 video per post, max 500MB, 3 min",
              detail: "Processed on Bluesky servers",
            }}
          />

          {/* GIF search */}
          <ToolbarButton
            icon={<span className="text-sm font-bold">GIF</span>}
            onClick={onOpenGiphy}
            disabled={isPosting || media.length > 0 || isVideoUploading}
            label="Search GIFs"
            badge={hasGif ? 1 : undefined}
            active={hasGif}
            tooltip={{
              title: "Add GIF",
              description: "Search Tenor for GIFs",
              detail: "GIF is mutually exclusive with images/videos",
            }}
          />

          {/* Emoji picker */}
          <ToolbarButton
            icon={<Smile size={20} />}
            onClick={onOpenEmoji}
            disabled={isPosting}
            label="Add emoji"
            tooltip={{
              title: "Add Emoji",
              description: "Insert emoji at cursor",
            }}
          />

          {/* Standard features - conditionally visible */}
          {showStandardFeatures && (
            <>
              {/* Tone adjustment */}
              <ToolbarButton
                icon={<Wand2 size={20} />}
                onClick={onToggleToneOptions}
                disabled={isPosting || isAdjustingTone}
                label="Adjust tone"
                active={!!selectedTone}
                tooltip={{
                  title: "Adjust Tone",
                  description: "AI-powered tone adjustment",
                }}
              />
            </>
          )}

          {/* Advanced features - conditionally visible */}
          {showAdvancedFeatures && (
            <>
              {/* Writing feedback */}
              <ToolbarButton
                icon={<MessageSquare size={20} />}
                onClick={onRequestFeedback}
                disabled={isPosting || isLoadingFeedback || !text.trim()}
                label="Get writing feedback"
                loading={isLoadingFeedback}
                tooltip={{
                  title: "Writing Feedback",
                  description: "Get AI feedback on your post",
                  detail: "Check clarity, tone, and engagement",
                }}
              >
                <span className="hidden text-xs sm:inline">Feedback</span>
              </ToolbarButton>
            </>
          )}
        </div>

        {/* Progressive disclosure toggle */}
        {enableProgressiveDisclosure && (
          <button
            className="touch-target-sm asph-button-secondary flex items-center gap-1 px-2 py-1 text-xs"
            onClick={toggleDisclosure}
            aria-label={`Switch to ${disclosureLevel === "advanced" ? "basic" : "more"} features`}
          >
            <span>{getDisclosureLevelLabel()}</span>
            {disclosureLevel === "advanced" ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInputChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Disclosure level indicator for progressive disclosure */}
      {enableProgressiveDisclosure && disclosureLevel !== "primary" && (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          <div className="flex gap-1">
            <span className="h-1.5 w-6 rounded-full bg-blue-500 transition-colors" />
            <span
              className={`h-1.5 w-6 rounded-full transition-colors ${
                disclosureLevel === "advanced"
                  ? "bg-blue-500"
                  : "bg-asph-bg-active"
              }`}
            />
          </div>
          <span>
            {disclosureLevel === "standard"
              ? "Standard features"
              : "All features"}
          </span>
        </div>
      )}
    </div>
  );
};

// Toolbar button component
interface ToolbarButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  badge?: number;
  active?: boolean;
  loading?: boolean;
  tooltip?: {
    title: string;
    description: string;
    detail?: string;
  };
  children?: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  onClick,
  disabled,
  label,
  badge,
  active,
  loading,
  tooltip,
  children,
}) => {
  return (
    <div className="group relative">
      <button
        className={`touch-target asph-button-secondary relative flex items-center gap-2 ${
          active ? "ring-2 ring-blue-400" : ""
        } ${loading ? "animate-pulse" : ""}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
        {children}
        {badge !== undefined && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white"
            style={{ background: "var(--asph-primary)" }}
          >
            {badge}
          </span>
        )}
      </button>
      {tooltip && (
        <div className="absolute bottom-full right-0 z-10 mb-2 hidden group-hover:block">
          <div className="whitespace-nowrap rounded-lg bg-asph-text-primary px-3 py-2 text-xs text-asph-bg-secondary">
            <div className="mb-1 font-semibold">{tooltip.title}</div>
            <div>{tooltip.description}</div>
            {tooltip.detail && (
              <div className="mt-1 text-asph-bg-tertiary">{tooltip.detail}</div>
            )}
            <div className="absolute bottom-0 right-4 h-2 w-2 translate-y-1/2 rotate-45 transform bg-asph-text-primary"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposerToolbar;
