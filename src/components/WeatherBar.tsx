/**
 * WeatherBar (Web)
 *
 * A subtle bar at the top of the feed showing the network weather report
 * and narrative thread chips. Click a chip to see narrative detail.
 *
 * See: docs/vision/network-weather.md (Layers 2-3)
 */

import { useMemo, useState } from "react";
import type {
  NetworkWeatherState,
  WeatherHue,
} from "../services/network-weather";
import { WEATHER_COLORS } from "../services/network-weather";
import { generateWeatherReport } from "../services/weather-report";

interface Props {
  weather: NetworkWeatherState | null | undefined;
}

const HUE_POOL: WeatherHue[] = [
  "indigo",
  "rust",
  "ochre",
  "sage",
  "slate",
  "sienna",
  "charcoal",
  "ivory",
];

function assignHue(name: string, index: number): WeatherHue {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return HUE_POOL[Math.abs(hash + index) % HUE_POOL.length];
}

function getColor(hue: WeatherHue): string {
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? WEATHER_COLORS[hue].dark : WEATHER_COLORS[hue].light;
}

export function WeatherBar({ weather }: Props) {
  const [expanded, setExpanded] = useState(false);

  const report = useMemo(
    () => (weather ? generateWeatherReport(weather) : null),
    [weather],
  );

  if (!weather || !report) return null;

  const narratives = weather.narratives?.narratives ?? [];

  return (
    <div
      className="cursor-pointer select-none border-b px-4 py-2 transition-all duration-500"
      style={{
        borderColor: "var(--asph-border-primary)",
        backgroundColor: "var(--asph-bg-secondary)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Report line */}
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--asph-text-tertiary)" }}
      >
        {report}
      </p>

      {/* Expandable thread chips */}
      {expanded && narratives.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {narratives.slice(0, 8).map((n, i) => {
            const hue = assignHue(n.name, i);
            const color = getColor(hue);
            return (
              <button
                key={n.id}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:opacity-80"
                style={{ borderColor: color }}
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: navigate to narrative detail
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  {n.name}
                </span>
                {n.threadType === "weft" && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    emergent
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
