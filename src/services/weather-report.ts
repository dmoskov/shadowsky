/**
 * Weather Report — one-line summary of network state (web version).
 * Same logic as mobile, no AI call.
 */

import type { NetworkWeatherState, WeatherHue } from "./network-weather";
import { WEATHER_CACHE_TTL } from "./network-weather";

const HUE_DESCRIPTORS: Record<WeatherHue, string[]> = {
  indigo: ["technical", "analytical", "scientific"],
  rust: ["creative", "cultural", "artistic"],
  ochre: ["communal", "celebratory", "warm"],
  sage: ["learning", "curious", "exploratory"],
  slate: ["structural", "political", "institutional"],
  sienna: ["personal", "intimate", "reflective"],
  charcoal: ["contested", "tense", "debated"],
  ivory: ["meta", "platform-aware", "self-referential"],
};

/** Deterministic pick — uses a seed to always return the same word for the same state */
let _seed = 0;
function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function describeHue(hue: WeatherHue): string {
  return seededPick(HUE_DESCRIPTORS[hue], _seed++);
}

/**
 * Energy adjective, or null when energy isn't a real measurement.
 *
 * Calling the network "buzzing" off a placeholder value is worse than saying
 * nothing, so callers drop the clause entirely rather than assert.
 */
function describeEnergy(weather: NetworkWeatherState): string | null {
  if (!weather.energyReliable) return null;
  const { energy } = weather;
  if (energy < 0.3) return seededPick(["quiet", "gentle", "calm"], _seed++);
  if (energy < 0.65) return seededPick(["steady", "active", "alive"], _seed++);
  return seededPick(["buzzing", "energetic", "intense"], _seed++);
}

export function generateWeatherReport(weather: NetworkWeatherState): string {
  _seed = Math.floor(weather.timestamp / WEATHER_CACHE_TTL); // Same seed for same 5-min window
  const emergent =
    weather.emergence?.emergentThreads?.filter((t) => t.isEmergent) ?? [];
  if (emergent.length > 0) {
    const top = emergent[0];
    const age =
      top.ageMinutes < 1
        ? "just now"
        : top.ageMinutes < 60
          ? `${top.ageMinutes}m ago`
          : `${Math.round(top.ageMinutes / 60)}h ago`;
    const growth =
      top.countRatio >= 1.5 && top.countRatio < 100
        ? `mentions up ${Math.round(top.countRatio)}×`
        : "growing fast";
    return `Emerging across Bluesky: “${top.token}” — ${growth} · started ${age}`;
  }

  if (weather.narratives && weather.narratives.narratives.length >= 3) {
    const warp = weather.narratives.narratives.filter(
      (n) => n.threadType === "warp",
    );
    const weft = weather.narratives.narratives.filter(
      (n) => n.threadType === "weft",
    );
    const energy = describeEnergy(weather);
    const suffix = energy ? ` · ${energy}` : "";

    // "X weaving through Y" only makes sense with a thread on each axis. With
    // no weft the old fallback produced "X weaving through threads", which
    // reads as a missing value rather than a description.
    if (warp[0] && weft[0]) {
      return `${warp[0].name} weaving through ${weft[0].name}${suffix}`;
    }
    const only = warp[0] ?? weft[0];
    if (only) {
      return `The network is holding on ${only.name}${suffix}`;
    }
  }

  const dominant = describeHue(weather.dominantHue);
  const secondary = describeHue(weather.secondaryHue);
  const energy = describeEnergy(weather);

  if (weather.dominantHue === weather.secondaryHue) {
    return energy
      ? `A ${energy} ${dominant} tone across the network`
      : `A ${dominant} tone across the network`;
  }
  return `A wide ${dominant} conversation meeting a burst of ${secondary} energy`;
}
