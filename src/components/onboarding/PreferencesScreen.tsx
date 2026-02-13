import {
  Check,
  Eye,
  EyeOff,
  Filter,
  MessageCircle,
  Repeat,
} from "lucide-react";
import React, { useState } from "react";

interface PreferencesScreenProps {
  initialPreferences?: {
    hideReposts: boolean;
    hideReplies: boolean;
    showAdultContent: boolean;
  };
  onContinue: (preferences: {
    hideReposts: boolean;
    hideReplies: boolean;
    showAdultContent: boolean;
  }) => void;
  onBack: () => void;
}

export const PreferencesScreen: React.FC<PreferencesScreenProps> = ({
  initialPreferences = {
    hideReposts: false,
    hideReplies: false,
    showAdultContent: false,
  },
  onContinue,
  onBack,
}) => {
  const [preferences, setPreferences] = useState(initialPreferences);

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleComplete = () => {
    onContinue(preferences);
  };

  return (
    <div
      className="flex min-h-screen flex-col px-4 py-8"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--asph-primary-transparent)" }}
            >
              <Filter size={32} style={{ color: "var(--asph-primary)" }} />
            </div>
          </div>
          <h1
            className="mb-2 text-3xl font-bold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Content preferences
          </h1>
          <p
            className="text-lg"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Customize what you see in your timeline
          </p>
        </div>

        {/* Preferences List */}
        <div className="mb-8 space-y-3">
          {/* Hide Reposts */}
          <button
            onClick={() => togglePreference("hideReposts")}
            className="asph-card flex w-full items-start gap-4 p-5 text-left transition-all hover:shadow-md"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: preferences.hideReposts
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              }}
            >
              {preferences.hideReposts ? (
                <EyeOff size={20} style={{ color: "white" }} />
              ) : (
                <Repeat
                  size={20}
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
              )}
            </div>
            <div className="flex-1">
              <h3
                className="mb-1 font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Hide reposts
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Don't show posts that others have reposted in your timeline
              </p>
            </div>
            {preferences.hideReposts && (
              <Check size={24} style={{ color: "var(--asph-success)" }} />
            )}
          </button>

          {/* Hide Replies */}
          <button
            onClick={() => togglePreference("hideReplies")}
            className="asph-card flex w-full items-start gap-4 p-5 text-left transition-all hover:shadow-md"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: preferences.hideReplies
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              }}
            >
              {preferences.hideReplies ? (
                <EyeOff size={20} style={{ color: "white" }} />
              ) : (
                <MessageCircle
                  size={20}
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
              )}
            </div>
            <div className="flex-1">
              <h3
                className="mb-1 font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Hide replies
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Only show original posts, not replies to other posts
              </p>
            </div>
            {preferences.hideReplies && (
              <Check size={24} style={{ color: "var(--asph-success)" }} />
            )}
          </button>

          {/* Adult Content */}
          <button
            onClick={() => togglePreference("showAdultContent")}
            className="asph-card flex w-full items-start gap-4 p-5 text-left transition-all hover:shadow-md"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: preferences.showAdultContent
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              }}
            >
              {preferences.showAdultContent ? (
                <Eye size={20} style={{ color: "white" }} />
              ) : (
                <EyeOff
                  size={20}
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
              )}
            </div>
            <div className="flex-1">
              <h3
                className="mb-1 font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Show adult content
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Display posts marked as adult or sensitive content
              </p>
            </div>
            {preferences.showAdultContent && (
              <Check size={24} style={{ color: "var(--asph-success)" }} />
            )}
          </button>
        </div>

        {/* Info Note */}
        <div
          className="mb-8 rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <p
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            These preferences can be changed anytime in Settings. Content
            moderation labels from Bluesky will still apply.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={onBack}
            className="rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
            style={{
              color: "var(--asph-text-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            className="asph-button-primary flex items-center justify-center gap-2 px-8 py-3 font-semibold text-white"
          >
            <Check size={20} />
            Complete Setup
          </button>
        </div>
      </div>
    </div>
  );
};
