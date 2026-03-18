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

  // Hide entirely when running on fallback data (Pan API not connected)
  if (!weather || !report || weather.source === "fallback") return null;

  const narratives = weather.narratives?.narratives ?? [];

  return (
    <div
      className="cursor-pointer select-none px-4 py-3 transition-all duration-500"
      style={{
        backgroundColor: "var(--asph-primary)",
        color: "white",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Report line */}
      <p
        className="text-sm leading-relaxed font-medium"
        style={{ color: "white", opacity: 0.95 }}
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
                <span style={{ color: "white", opacity: 0.9 }}>
                  {n.name}
                </span>
                {n.threadType === "weft" && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: "white", opacity: 0.7 }}
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
