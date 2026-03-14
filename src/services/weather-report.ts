/**
 * Weather Report — one-line summary of network state (web version).
 * Same logic as mobile, no AI call.
 */

import type { NetworkWeatherState, WeatherHue } from "./network-weather";

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function describeHue(hue: WeatherHue): string {
  return pick(HUE_DESCRIPTORS[hue]);
}

function describeEnergy(energy: number): string {
  if (energy < 0.3) return pick(["quiet", "gentle", "calm"]);
  if (energy < 0.65) return pick(["steady", "active", "alive"]);
  return pick(["buzzing", "energetic", "intense"]);
}

export function generateWeatherReport(weather: NetworkWeatherState): string {
  const emergent = weather.emergence?.emergentThreads?.filter(t => t.isEmergent) ?? [];
  if (emergent.length > 0) {
    const top = emergent[0];
    const age = top.ageMinutes < 60 ? `${top.ageMinutes}m` : `${Math.round(top.ageMinutes / 60)}h`;
    return `Something is forming around ${top.token} — growing fast with diverse voices · ${age}`;
  }

  if (weather.narratives && weather.narratives.narratives.length >= 3) {
    const warp = weather.narratives.narratives.filter(n => n.threadType === "warp");
    const weft = weather.narratives.narratives.filter(n => n.threadType === "weft");
    const topWarp = warp[0]?.name ?? "conversation";
    const topWeft = weft[0]?.name ?? "threads";
    const energy = describeEnergy(weather.energy);
    return `${topWarp} weaving through ${topWeft} · ${energy}`;
  }

  const dominant = describeHue(weather.dominantHue);
  const secondary = describeHue(weather.secondaryHue);
  const energy = describeEnergy(weather.energy);

  if (weather.dominantHue === weather.secondaryHue) {
    return `A ${energy} ${dominant} tone across the network`;
  }
  return `A wide ${dominant} conversation meeting a burst of ${secondary} energy`;
}
