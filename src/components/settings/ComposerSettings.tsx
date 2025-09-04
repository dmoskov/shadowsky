import { Wand2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { appPreferencesService } from "../../services/app-preferences-service";
import {
  getComposerSettings,
  saveComposerSettings,
} from "../../services/drafts";
import { AISettings, AISettingsPanel } from "./AISettingsPanel";

export const ComposerSettings: React.FC = () => {
  const [settings, setSettings] = useState(getComposerSettings());
  const [aiSettings, setAiSettings] = useState<AISettings>({
    autoGenerateAltText: false,
    enableSmartReplies: false,
    enableHashtagSuggestions: false,
    enableWritingFeedback: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getComposerSettings());

    // Load AI settings from app preferences
    const loadAiSettings = async () => {
      const prefs = await appPreferencesService.getPreferences();
      if (prefs?.aiSettings) {
        setAiSettings(prefs.aiSettings);
      }
    };

    loadAiSettings();
  }, []);

  const handleChange = (
    key: keyof typeof settings,
    value: boolean | string | number,
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveComposerSettings(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAiSettingsChange = async (newAiSettings: AISettings) => {
    setAiSettings(newAiSettings);

    // Save to app preferences
    await appPreferencesService.updatePreferences({
      aiSettings: newAiSettings,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          <Wand2 size={24} />
          Composer & AI Features
        </h2>
        <p
          className="mb-6 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Configure your posting experience and AI-powered features.
        </p>
      </div>

      {/* AI Features Section */}
      <AISettingsPanel
        settings={aiSettings}
        onChange={handleAiSettingsChange}
      />

      {/* Thread Settings Section */}
      <div
        className="rounded-lg border p-4"
        style={{
          borderColor: "var(--bsky-border-primary)",
          backgroundColor: "var(--bsky-bg-secondary)",
        }}
      >
        <h3
          className="mb-4 text-lg font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Thread Settings
        </h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="numbering-format"
              className="mb-2 block font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Numbering Format
            </label>
            <select
              id="numbering-format"
              value={settings.numberingFormat}
              onChange={(e) => handleChange("numberingFormat", e.target.value)}
              className="w-full rounded-lg border p-2"
              style={{
                backgroundColor: "var(--bsky-bg-primary)",
                borderColor: "var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
              }}
            >
              <option value="none">No numbering</option>
              <option value="simple">Simple (1/5)</option>
              <option value="brackets">Brackets ([1/5])</option>
              <option value="thread">Thread (🧵 1/5)</option>
              <option value="dots">Dots (1•5)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="numbering-position"
              className="mb-2 block font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Numbering Position
            </label>
            <select
              id="numbering-position"
              value={settings.numberingPosition}
              onChange={(e) =>
                handleChange("numberingPosition", e.target.value)
              }
              className="w-full rounded-lg border p-2"
              style={{
                backgroundColor: "var(--bsky-bg-primary)",
                borderColor: "var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
              }}
            >
              <option value="beginning">Beginning</option>
              <option value="end">End</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="delay-seconds"
              className="mb-2 block font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Post Delay (seconds)
            </label>
            <input
              id="delay-seconds"
              type="number"
              min="0"
              max="30"
              value={settings.defaultDelaySeconds}
              onChange={(e) =>
                handleChange(
                  "defaultDelaySeconds",
                  parseInt(e.target.value) || 0,
                )
              }
              className="w-full rounded-lg border p-2"
              style={{
                backgroundColor: "var(--bsky-bg-primary)",
                borderColor: "var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
              }}
            />
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Time to cancel before posting (0 for instant)
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div
        className="rounded-lg border p-4 text-sm"
        style={{
          borderColor: "var(--bsky-border-primary)",
          backgroundColor: "var(--bsky-bg-secondary)",
          color: "var(--bsky-text-secondary)",
        }}
      >
        <p className="mb-1 font-medium">Privacy Notice</p>
        <p>
          AI features require an Anthropic API key and send your content to
          Anthropic's servers for processing. No data is stored by the AI
          service.
        </p>
      </div>

      {saved && (
        <div
          className="rounded-lg border p-3 text-center text-sm font-medium"
          style={{
            borderColor: "var(--bsky-success)",
            backgroundColor: "var(--bsky-success-bg)",
            color: "var(--bsky-success)",
          }}
        >
          Settings saved successfully!
        </div>
      )}
    </div>
  );
};
