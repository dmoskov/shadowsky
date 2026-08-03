import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns, Monitor, Moon, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  DEFAULT_COLUMN_WIDTH,
  appPreferencesService,
} from "../../services/app-preferences-service";

const WIDTH_OPTIONS = [
  { value: 0, label: "Single column" },
  { value: 280, label: "Deck — compact" },
  { value: 320, label: "Deck — medium" },
  { value: 360, label: "Deck — comfortable" },
  { value: 400, label: "Deck — spacious" },
];

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWidth, setSelectedWidth] = useState(DEFAULT_COLUMN_WIDTH);

  // Get current preferences
  const { data: appPreferences } = useQuery({
    queryKey: ["appPreferences"],
    queryFn: async () => {
      if (!agent) return null;
      appPreferencesService.setAgent(agent);
      return await appPreferencesService.getPreferences();
    },
    enabled: !!agent,
  });

  // Load column width from preferences
  useEffect(() => {
    if (appPreferences && appPreferences.columnWidth != null) {
      setSelectedWidth(appPreferences.columnWidth);
    }
  }, [appPreferences]);

  // Update column width mutation
  const updateColumnWidth = useMutation({
    mutationFn: async (width: number) => {
      if (!agent) throw new Error("Not authenticated");
      appPreferencesService.setAgent(agent);
      await appPreferencesService.updatePreferences({ columnWidth: width });
      return width;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appPreferences"] });
      // Reload to apply new column width
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
  });

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
          style={{ color: "var(--asph-text-primary)" }}
        >
          Appearance
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Customize how Asphodel looks on your device
        </p>
      </div>

      <div>
        <label
          className="mb-3 block text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
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
                className={`touch-target flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                  theme === themeOption.value
                    ? "border-blue-500"
                    : "border-asph-border-primary hover:border-asph-border-secondary"
                }`}
                style={{
                  backgroundColor:
                    theme === themeOption.value
                      ? "var(--asph-bg-tertiary)"
                      : "var(--asph-bg-secondary)",
                  borderColor:
                    theme === themeOption.value
                      ? "var(--asph-primary)"
                      : "var(--asph-border-primary)",
                }}
              >
                <Icon
                  size={24}
                  style={{
                    color:
                      theme === themeOption.value
                        ? "var(--asph-primary)"
                        : "var(--asph-text-secondary)",
                  }}
                />
                <span
                  className="text-sm font-medium"
                  style={{
                    color:
                      theme === themeOption.value
                        ? "var(--asph-primary)"
                        : "var(--asph-text-primary)",
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
          style={{ color: "var(--asph-text-primary)" }}
        >
          Preview
        </h3>
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <div
            className="mb-2 text-sm font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Sample Post
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            This is how text will appear with your selected theme.
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="touch-target-sm rounded px-3 py-1 text-sm"
              style={{
                backgroundColor: "var(--asph-primary)",
                color: "white",
              }}
            >
              Primary Button
            </button>
            <button
              className="touch-target-sm rounded px-3 py-1 text-sm"
              style={{
                backgroundColor: "var(--asph-bg-tertiary)",
                color: "var(--asph-text-primary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              Secondary Button
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3
          className="text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Columns className="mr-2 inline-block h-4 w-4" />
          Layout
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
            Single column shows one feed at a time, like the standard Bluesky
            app. Deck mode shows your feeds side by side — pick a column width
            to turn it on.
          </p>
          <div className="space-y-3">
            <div className="grid gap-2">
              {WIDTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedWidth(option.value)}
                  className={`touch-target flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all ${
                    selectedWidth === option.value
                      ? "border-blue-500"
                      : "border-transparent hover:border-asph-border-secondary"
                  }`}
                  style={{
                    backgroundColor:
                      selectedWidth === option.value
                        ? "var(--asph-bg-tertiary)"
                        : "var(--asph-bg-primary)",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {option.label}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    {option.value === 0 ? "Default" : `${option.value}px`}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => updateColumnWidth.mutate(selectedWidth)}
              disabled={
                updateColumnWidth.isPending ||
                selectedWidth ===
                  (appPreferences?.columnWidth ?? DEFAULT_COLUMN_WIDTH)
              }
              className="touch-target-sm mt-3 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor:
                  updateColumnWidth.isPending ||
                  selectedWidth ===
                    (appPreferences?.columnWidth ?? DEFAULT_COLUMN_WIDTH)
                    ? "var(--asph-bg-tertiary)"
                    : "var(--asph-primary)",
                color:
                  updateColumnWidth.isPending ||
                  selectedWidth ===
                    (appPreferences?.columnWidth ?? DEFAULT_COLUMN_WIDTH)
                    ? "var(--asph-text-secondary)"
                    : "white",
              }}
            >
              {updateColumnWidth.isPending ? "Applying..." : "Apply Layout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
