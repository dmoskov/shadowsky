/**
 * Weather Report — factual headline for the WeatherBar (web).
 *
 * Only the emergent-topic case produces text here; trending topics are
 * rendered as links by WeatherBar itself. Hue and energy are expressed as
 * color by the ambient layers (bar tint, background wash), never as prose.
 */

import type { EmergentThread } from "./network-weather";

export function describeEmergent(top: EmergentThread): string {
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
