/**
 * Weather Report Service
 *
 * Factual headline for the weather reveal. Only the emergent-topic case
 * produces text here; trending topics are rendered as tappable links by
 * WeatherRevealOverlay. Hue and energy are expressed as color by the
 * ambient textile, never as prose. Mirrors src/services/weather-report.ts
 * on web.
 */

import type { EmergentThread } from "./network-weather-service";

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
