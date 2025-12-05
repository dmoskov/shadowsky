/**
 * ComposerSettings - Level 2 (Standard) Component
 * Expandable section - thread numbering, delay, and AI settings
 */

import { Settings } from "lucide-react";
import React from "react";
import { AISettingsPanel } from "../settings/AISettingsPanel";
import {
  NUMBERING_FORMATS,
  type NumberingFormatType,
  type NumberingPosition,
} from "./types";

interface ComposerSettingsProps {
  // Settings visibility
  showSettings: boolean;
  onToggleSettings: () => void;

  // Numbering settings
  numberingFormat: NumberingFormatType;
  onNumberingFormatChange: (format: NumberingFormatType) => void;
  numberingPosition: NumberingPosition;
  onNumberingPositionChange: (position: NumberingPosition) => void;

  // Delay settings
  delaySeconds: number;
  onDelaySecondsChange: (seconds: number) => void;

  // AI settings
  autoGenerateAltText: boolean;
  enableHashtagSuggestions: boolean;
  onAISettingsChange: (settings: {
    autoGenerateAltText: boolean;
    enableHashtagSuggestions: boolean;
  }) => void;
}

export const ComposerSettings: React.FC<ComposerSettingsProps> = ({
  showSettings,
  onToggleSettings,
  numberingFormat,
  onNumberingFormatChange,
  numberingPosition,
  onNumberingPositionChange,
  delaySeconds,
  onDelaySecondsChange,
  autoGenerateAltText,
  enableHashtagSuggestions,
  onAISettingsChange,
}) => {
  return (
    <div
      className="mb-3 flex items-center justify-between border-b pb-3"
      style={{ borderColor: "var(--bsky-border-primary)" }}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm md:gap-4">
        {showSettings ? (
          <ExpandedSettings
            numberingFormat={numberingFormat}
            onNumberingFormatChange={onNumberingFormatChange}
            numberingPosition={numberingPosition}
            onNumberingPositionChange={onNumberingPositionChange}
            delaySeconds={delaySeconds}
            onDelaySecondsChange={onDelaySecondsChange}
            autoGenerateAltText={autoGenerateAltText}
            enableHashtagSuggestions={enableHashtagSuggestions}
            onAISettingsChange={onAISettingsChange}
          />
        ) : (
          <CollapsedSettings
            numberingFormat={numberingFormat}
            numberingPosition={numberingPosition}
            delaySeconds={delaySeconds}
            autoGenerateAltText={autoGenerateAltText}
          />
        )}
      </div>

      <button
        className="bsky-button-secondary p-1.5"
        onClick={onToggleSettings}
        aria-label="Toggle settings"
      >
        <Settings size={16} />
      </button>
    </div>
  );
};

interface ExpandedSettingsProps {
  numberingFormat: NumberingFormatType;
  onNumberingFormatChange: (format: NumberingFormatType) => void;
  numberingPosition: NumberingPosition;
  onNumberingPositionChange: (position: NumberingPosition) => void;
  delaySeconds: number;
  onDelaySecondsChange: (seconds: number) => void;
  autoGenerateAltText: boolean;
  enableHashtagSuggestions: boolean;
  onAISettingsChange: (settings: {
    autoGenerateAltText: boolean;
    enableHashtagSuggestions: boolean;
  }) => void;
}

const ExpandedSettings: React.FC<ExpandedSettingsProps> = ({
  numberingFormat,
  onNumberingFormatChange,
  numberingPosition,
  onNumberingPositionChange,
  delaySeconds,
  onDelaySecondsChange,
  autoGenerateAltText,
  enableHashtagSuggestions,
  onAISettingsChange,
}) => {
  return (
    <>
      {/* Numbering format */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="numbering-format"
          className="text-xs"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Format:
        </label>
        <select
          id="numbering-format"
          value={numberingFormat}
          onChange={(e) =>
            onNumberingFormatChange(e.target.value as NumberingFormatType)
          }
          className="rounded px-2 py-1 text-sm"
          style={{
            background: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-primary)",
            outline: "none",
          }}
        >
          {NUMBERING_FORMATS.map((format) => (
            <option key={format.id} value={format.id}>
              {format.name} {format.example && `(${format.example})`}
            </option>
          ))}
        </select>
      </div>

      {/* Numbering position */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="numbering-position"
          className="text-xs"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Position:
        </label>
        <select
          id="numbering-position"
          value={numberingPosition}
          onChange={(e) =>
            onNumberingPositionChange(e.target.value as NumberingPosition)
          }
          className="rounded px-2 py-1 text-sm"
          style={{
            background: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-primary)",
            outline: "none",
          }}
        >
          <option value="beginning">Beginning</option>
          <option value="end">End</option>
        </select>
      </div>

      {/* AI Settings */}
      <div
        className="mt-2 border-t pt-2"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <AISettingsPanel
          settings={{
            autoGenerateAltText,
            enableHashtagSuggestions,
          }}
          onChange={onAISettingsChange}
          compact={true}
        />
      </div>

      {/* Delay settings */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="send-delay"
          className="text-xs"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Delay:
        </label>
        <input
          id="send-delay"
          type="number"
          value={delaySeconds}
          onChange={(e) =>
            onDelaySecondsChange(
              Math.max(0, Math.min(300, parseInt(e.target.value) || 0)),
            )
          }
          min="0"
          max="300"
          className="w-16 rounded px-2 py-1 text-center text-sm"
          style={{
            background: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-primary)",
          }}
        />
        <span
          className="text-xs"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          sec
        </span>
      </div>
    </>
  );
};

interface CollapsedSettingsProps {
  numberingFormat: NumberingFormatType;
  numberingPosition: NumberingPosition;
  delaySeconds: number;
  autoGenerateAltText: boolean;
}

const CollapsedSettings: React.FC<CollapsedSettingsProps> = ({
  numberingFormat,
  numberingPosition,
  delaySeconds,
  autoGenerateAltText,
}) => {
  const formatName = NUMBERING_FORMATS.find(
    (f) => f.id === numberingFormat,
  )?.name;

  return (
    <span className="text-xs" style={{ color: "var(--bsky-text-tertiary)" }}>
      {numberingFormat !== "none" && `${formatName} • `}
      {numberingPosition === "beginning" ? "Start" : "End"} •
      {delaySeconds > 0 ? ` ${delaySeconds}s delay` : " Instant"}
      {autoGenerateAltText && " • Auto-alt"}
    </span>
  );
};

export default ComposerSettings;
