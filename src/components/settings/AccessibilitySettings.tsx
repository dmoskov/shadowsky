import {
  Accessibility,
  Contrast,
  Eye,
  Focus,
  Gauge,
  LucideIcon,
  MonitorCheck,
  Play,
  Video,
  VolumeX,
} from "lucide-react";
import React from "react";
import {
  AccessibilitySettings as AccessibilitySettingsType,
  useAccessibility,
} from "../../contexts/AccessibilityContext";

export const AccessibilitySettings: React.FC = () => {
  const { settings, updateSettings, systemPrefersReducedMotion } =
    useAccessibility();

  const motionOptions: {
    value: AccessibilitySettingsType["reduceMotion"];
    label: string;
    description: string;
    icon: LucideIcon;
  }[] = [
    {
      value: "system",
      label: "System",
      description: `Follow OS setting (currently ${systemPrefersReducedMotion ? "reduced" : "normal"})`,
      icon: MonitorCheck,
    },
    {
      value: "off",
      label: "Normal Motion",
      description: "Enable all animations and transitions",
      icon: Gauge,
    },
    {
      value: "on",
      label: "Reduce Motion",
      description: "Disable animations and transitions",
      icon: Eye,
    },
  ];

  const focusOptions: {
    value: AccessibilitySettingsType["focusIndicators"];
    label: string;
    description: string;
  }[] = [
    {
      value: "default",
      label: "Default",
      description: "Standard focus indicators",
    },
    {
      value: "enhanced",
      label: "Enhanced",
      description: "More visible focus indicators for keyboard navigation",
    },
  ];

  const videoAutoplayOptions: {
    value: AccessibilitySettingsType["videoAutoplay"];
    label: string;
    description: string;
    icon: LucideIcon;
  }[] = [
    {
      value: "off",
      label: "Off",
      description: "Videos require a click to play",
      icon: Video,
    },
    {
      value: "muted",
      label: "Muted Autoplay",
      description: "Videos autoplay muted when scrolling in feeds",
      icon: VolumeX,
    },
    {
      value: "on",
      label: "Full Autoplay",
      description: "Videos autoplay with sound (not recommended)",
      icon: Play,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="flex items-center gap-2 text-xl font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Accessibility size={24} />
          Accessibility
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Customize accessibility settings to improve your experience
        </p>
      </div>

      {/* High Contrast Mode */}
      <div className="space-y-4">
        <h3
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Contrast size={18} />
          High Contrast Mode
        </h3>
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p
                className="font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Enable High Contrast
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Increases color contrast for better readability. Meets WCAG AAA
                standards (7:1 contrast ratio).
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.highContrast}
              onClick={() =>
                updateSettings({ highContrast: !settings.highContrast })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full spring-toggle ${
                settings.highContrast ? "bg-blue-500" : "bg-gray-400"
              }`}
              style={{
                backgroundColor: settings.highContrast
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              }}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm spring-toggle ${
                  settings.highContrast ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div
            className="mt-4 rounded-lg p-3"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              border: "1px solid var(--asph-border-secondary)",
            }}
          >
            <p
              className="mb-2 text-xs font-medium"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Preview
            </p>
            <div className="space-y-2">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Primary Text
              </p>
              <p
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Secondary text for descriptions
              </p>
              <div className="flex gap-2">
                <span
                  className="rounded px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--asph-primary)",
                    color: "white",
                  }}
                >
                  Button
                </span>
                <span
                  className="rounded px-2 py-1 text-xs"
                  style={{
                    backgroundColor: "var(--asph-success)",
                    color: "white",
                  }}
                >
                  Success
                </span>
                <span
                  className="rounded px-2 py-1 text-xs"
                  style={{
                    backgroundColor: "var(--asph-error)",
                    color: "white",
                  }}
                >
                  Error
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reduced Motion */}
      <div className="space-y-4">
        <h3
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Gauge size={18} />
          Motion & Animations
        </h3>
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Control how animations and transitions appear. Reducing motion can
            help with motion sensitivity or vestibular disorders.
          </p>
          <div className="space-y-2">
            {motionOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.reduceMotion === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => updateSettings({ reduceMotion: option.value })}
                  className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                    isSelected ? "ring-2 ring-blue-500" : ""
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? "var(--asph-bg-tertiary)"
                      : "transparent",
                    border: `1px solid ${isSelected ? "var(--asph-primary)" : "var(--asph-border-primary)"}`,
                  }}
                  aria-pressed={isSelected}
                >
                  <Icon
                    size={20}
                    style={{
                      color: isSelected
                        ? "var(--asph-primary)"
                        : "var(--asph-text-secondary)",
                    }}
                  />
                  <div className="flex-1">
                    <p
                      className="font-medium"
                      style={{
                        color: isSelected
                          ? "var(--asph-primary)"
                          : "var(--asph-text-primary)",
                      }}
                    >
                      {option.label}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {option.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--asph-primary)" }}
                    >
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Focus Indicators */}
      <div className="space-y-4">
        <h3
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Focus size={18} />
          Focus Indicators
        </h3>
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Adjust the visibility of focus indicators when using keyboard
            navigation.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {focusOptions.map((option) => {
              const isSelected = settings.focusIndicators === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() =>
                    updateSettings({ focusIndicators: option.value })
                  }
                  className={`rounded-lg p-4 text-left transition-colors ${
                    isSelected ? "ring-2 ring-blue-500" : ""
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? "var(--asph-bg-tertiary)"
                      : "transparent",
                    border: `1px solid ${isSelected ? "var(--asph-primary)" : "var(--asph-border-primary)"}`,
                  }}
                  aria-pressed={isSelected}
                >
                  <p
                    className="font-medium"
                    style={{
                      color: isSelected
                        ? "var(--asph-primary)"
                        : "var(--asph-text-primary)",
                    }}
                  >
                    {option.label}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video Autoplay */}
      <div className="space-y-4">
        <h3
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Video size={18} />
          Video Autoplay
        </h3>
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Control how videos behave when scrolling through your feed. Muted
            autoplay helps you preview content without sudden sounds.
          </p>
          <div className="space-y-2">
            {videoAutoplayOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.videoAutoplay === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() =>
                    updateSettings({ videoAutoplay: option.value })
                  }
                  className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                    isSelected ? "ring-2 ring-blue-500" : ""
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? "var(--asph-bg-tertiary)"
                      : "transparent",
                    border: `1px solid ${isSelected ? "var(--asph-primary)" : "var(--asph-border-primary)"}`,
                  }}
                  aria-pressed={isSelected}
                >
                  <Icon
                    size={20}
                    style={{
                      color: isSelected
                        ? "var(--asph-primary)"
                        : "var(--asph-text-secondary)",
                    }}
                  />
                  <div className="flex-1">
                    <p
                      className="font-medium"
                      style={{
                        color: isSelected
                          ? "var(--asph-primary)"
                          : "var(--asph-text-primary)",
                      }}
                    >
                      {option.label}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {option.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--asph-primary)" }}
                    >
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <h3
          className="mb-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Keyboard Navigation
        </h3>
        <p className="text-sm" style={{ color: "var(--asph-text-secondary)" }}>
          Press{" "}
          <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">
            ?
          </kbd>{" "}
          to view all available keyboard shortcuts for navigating Asphodel.
        </p>
      </div>
    </div>
  );
};
