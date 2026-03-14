/**
 * Weather Report Service
 *
 * Generates a human-readable one-line summary of network state.
 * No AI call — just template-based generation from weather signals.
 * Fast, deterministic, no latency.
 *
 * Examples:
 *   "A wide technical conversation is meeting a burst of creative energy"
 *   "Quiet afternoon — a few personal threads weaving through"
 *   "Something is forming around AI policy — growing fast with diverse voices"
 */

import type { NetworkWeatherState, WeatherHue } from "./network-weather-service";

const HUE_DESCRIPTORS: Record<WeatherHue, string[]> = {
  indigo:   ["technical", "analytical", "scientific"],
  rust:     ["creative", "cultural", "artistic"],
  ochre:    ["communal", "celebratory", "warm"],
  sage:     ["learning", "curious", "exploratory"],
  slate:    ["structural", "political", "institutional"],
  sienna:   ["personal", "intimate", "reflective"],
  charcoal: ["contested", "tense", "debated"],
  ivory:    ["meta", "platform-aware", "self-referential"],
};

const ENERGY_WORDS = {
  low: ["quiet", "gentle", "calm", "unhurried"],
  medium: ["steady", "active", "alive"],
  high: ["buzzing", "energetic", "intense", "surging"],
};

/** Deterministic pick — uses a seed so the same weather state always produces the same text */
let _seed = 0;
function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function describeHue(hue: WeatherHue): string {
  return seededPick(HUE_DESCRIPTORS[hue], _seed++);
}

function describeEnergy(energy: number): string {
  if (energy < 0.3) return seededPick(ENERGY_WORDS.low, _seed);
  if (energy < 0.65) return seededPick(ENERGY_WORDS.medium, _seed);
  return seededPick(ENERGY_WORDS.high, _seed);
}

export function generateWeatherReport(weather: NetworkWeatherState): string {
  _seed = Math.floor(weather.timestamp / 300000); // Same seed for same 5-min window
  // Emergence takes priority
  const emergent = weather.emergence?.emergentThreads?.filter(t => t.isEmergent) ?? [];
  if (emergent.length > 0) {
    const top = emergent[0];
    const age = top.ageMinutes < 60
      ? `${top.ageMinutes}m`
      : `${Math.round(top.ageMinutes / 60)}h`;
    return `Something is forming around ${top.token} — growing fast with diverse voices · ${age}`;
  }

  // Full textile with narratives
  if (weather.narratives && weather.narratives.narratives.length >= 3) {
    const warp = weather.narratives.narratives.filter(n => n.threadType === "warp");
    const weft = weather.narratives.narratives.filter(n => n.threadType === "weft");
    const topWarp = warp[0]?.name ?? "conversation";
    const topWeft = weft[0]?.name ?? "threads";
    const energy = describeEnergy(weather.energy);

    if (weather.energy > 0.6) {
      return `${energy[0].toUpperCase() + energy.slice(1)} network — ${topWarp} intersecting with ${topWeft}`;
    }
    return `${topWarp} weaving through ${topWeft} · ${energy} afternoon`;
  }

  // Two-tone mode
  const dominant = describeHue(weather.dominantHue);
  const secondary = describeHue(weather.secondaryHue);
  const energy = describeEnergy(weather.energy);

  if (weather.dominantHue === weather.secondaryHue) {
    return `A ${energy} ${dominant} tone across the network`;
  }

  if (weather.energy < 0.3) {
    return `${energy[0].toUpperCase() + energy.slice(1)} — a few ${dominant} threads with touches of ${secondary}`;
  }

  return `A wide ${dominant} conversation is meeting a burst of ${secondary} energy`;
}
