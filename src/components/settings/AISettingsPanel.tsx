import { Sparkles } from "lucide-react";
import React from "react";

export interface AISettings {
  autoGenerateAltText: boolean;
  enableHashtagSuggestions: boolean;
}

interface AISettingsPanelProps {
  settings: AISettings;
  onChange: (settings: AISettings) => void;
  compact?: boolean;
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({
  settings,
  onChange,
  compact = false,
}) => {
  const handleChange = (key: keyof AISettings, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  const containerClass = compact
    ? "space-y-3"
    : "rounded-lg border p-4 space-y-4";

  const containerStyle = compact
    ? {}
    : {
        borderColor: "var(--asph-border-primary)",
        backgroundColor: "var(--asph-bg-secondary)",
      };

  return (
    <div className={containerClass} style={containerStyle}>
      {!compact && (
        <h3
          className="mb-4 flex items-center gap-2 text-lg font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Sparkles size={20} />
          AI-Powered Features
        </h3>
      )}

      <div className={compact ? "space-y-3" : "space-y-4"}>
        <label className="flex items-center justify-between">
          <div className="flex-1">
            <div
              className={compact ? "text-sm font-medium" : "font-medium"}
              style={{ color: "var(--asph-text-primary)" }}
            >
              Auto-generate Alt Text
            </div>
            {!compact && (
              <div
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Automatically generate descriptive alt text for images
              </div>
            )}
          </div>
          <input
            type="checkbox"
            checked={settings.autoGenerateAltText}
            onChange={(e) =>
              handleChange("autoGenerateAltText", e.target.checked)
            }
            className="ml-4 h-4 w-4 rounded border-gray-300 text-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div className="flex-1">
            <div
              className={compact ? "text-sm font-medium" : "font-medium"}
              style={{ color: "var(--asph-text-primary)" }}
            >
              Hashtag Suggestions
            </div>
            {!compact && (
              <div
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Get relevant hashtag suggestions based on your post content
              </div>
            )}
          </div>
          <input
            type="checkbox"
            checked={settings.enableHashtagSuggestions}
            onChange={(e) =>
              handleChange("enableHashtagSuggestions", e.target.checked)
            }
            className="ml-4 h-4 w-4 rounded border-gray-300 text-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </label>
      </div>
    </div>
  );
};
