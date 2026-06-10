import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns, Monitor, Moon, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { appPreferencesService } from "../../services/app-preferences-service";

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWidth, setSelectedWidth] = useState(320);

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
    if (appPreferences?.columnWidth) {
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
          Column Width
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
            Adjust the width of columns in your home feed. Smaller widths allow
            more columns to fit on screen.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Width: {selectedWidth}px
              </label>
              <span
                className="text-xs"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {selectedWidth === 280 && "Compact"}
                {selectedWidth === 320 && "Default"}
                {selectedWidth === 360 && "Comfortable"}
                {selectedWidth === 400 && "Spacious"}
              </span>
            </div>
            <input
              type="range"
              min="280"
              max="400"
              step="40"
              value={selectedWidth}
              onChange={(e) => setSelectedWidth(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{
                background: `linear-gradient(to right, var(--asph-primary) 0%, var(--asph-primary) ${((selectedWidth - 280) / 120) * 100}%, var(--asph-bg-tertiary) ${((selectedWidth - 280) / 120) * 100}%, var(--asph-bg-tertiary) 100%)`,
              }}
            />
            <div
              className="flex justify-between text-xs"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              <span>280px</span>
              <span>320px</span>
              <span>360px</span>
              <span>400px</span>
            </div>
            <button
              onClick={() => updateColumnWidth.mutate(selectedWidth)}
              disabled={
                updateColumnWidth.isPending ||
                selectedWidth === appPreferences?.columnWidth
              }
              className="touch-target-sm mt-3 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor:
                  updateColumnWidth.isPending ||
                  selectedWidth === appPreferences?.columnWidth
                    ? "var(--asph-bg-tertiary)"
                    : "var(--asph-primary)",
                color:
                  updateColumnWidth.isPending ||
                  selectedWidth === appPreferences?.columnWidth
                    ? "var(--asph-text-secondary)"
                    : "white",
              }}
            >
              {updateColumnWidth.isPending ? "Applying..." : "Apply Width"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
