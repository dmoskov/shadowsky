import { Monitor, Moon, Sun } from "lucide-react";
import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Appearance
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Customize how ShadowSky looks on your device
        </p>
      </div>

      <div>
        <label
          className="mb-3 block text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Theme
        </label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            return (
              <button
                key={themeOption.value}
                onClick={() => setTheme(themeOption.value as any)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                  theme === themeOption.value
                    ? "border-blue-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{
                  backgroundColor:
                    theme === themeOption.value
                      ? "var(--bsky-bg-tertiary)"
                      : "var(--bsky-bg-secondary)",
                  borderColor:
                    theme === themeOption.value
                      ? "var(--bsky-primary)"
                      : "var(--bsky-border-primary)",
                }}
              >
                <Icon
                  size={24}
                  style={{
                    color:
                      theme === themeOption.value
                        ? "var(--bsky-primary)"
                        : "var(--bsky-text-secondary)",
                  }}
                />
                <span
                  className="text-sm font-medium"
                  style={{
                    color:
                      theme === themeOption.value
                        ? "var(--bsky-primary)"
                        : "var(--bsky-text-primary)",
                  }}
                >
                  {themeOption.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h3
          className="text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Preview
        </h3>
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div
            className="mb-2 text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Sample Post
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            This is how text will appear with your selected theme.
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded px-3 py-1 text-sm"
              style={{
                backgroundColor: "var(--bsky-primary)",
                color: "white",
              }}
            >
              Primary Button
            </button>
            <button
              className="rounded px-3 py-1 text-sm"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                color: "var(--bsky-text-primary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              Secondary Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
