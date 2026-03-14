/**
 * useNetworkWeatherPlaid — React hook for Network Weather plaid state
 *
 * Manages the three view modes (global, personal, gap) and provides
 * the active textile for rendering. Fetches narrative data from Pan,
 * falls back to Bluesky trending data, and handles personal filtering
 * using the followed DIDs set from useFollowing.
 *
 * Ref: docs/vision/network-weather.md § Your World vs. The World
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  computeGapAnalysis,
  fetchGlobalTextile,
  filterTextileByFollows,
  textileFromTrends,
  WEATHER_CACHE_TTL,
} from "../services/network-weather-service";
import type {
  GapAnalysis,
  NetworkWeatherState,
  TextileState,
  WeatherViewMode,
} from "../types/network-weather";
import { useFollowing } from "./useFollowing";
import { useTrends } from "./useTrending";

const VIEW_CYCLE: WeatherViewMode[] = ["global", "personal", "gap"];

export function useNetworkWeatherPlaid(): NetworkWeatherState {
  const [viewMode, setViewMode] = useState<WeatherViewMode>("global");

  // ─── Data Sources ────────────────────────────────────

  // Primary: Pan narratives endpoint
  const panQuery = useQuery({
    queryKey: ["networkWeather", "global"],
    queryFn: fetchGlobalTextile,
    staleTime: WEATHER_CACHE_TTL,
    gcTime: WEATHER_CACHE_TTL * 2,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fallback: Bluesky trending data
  const trendsQuery = useTrends({ limit: 15, enabled: true });
  const trendsData = trendsQuery.data;

  // Follows for personal filtering
  const followingQuery = useFollowing();

  // ─── Derived Textiles ────────────────────────────────

  const globalTextile = useMemo<TextileState | null>(() => {
    // Use Pan data if available
    if (panQuery.data && panQuery.data.threads.length > 0) {
      return panQuery.data;
    }

    // Fallback: build textile from trending data
    const trends = trendsData?.trends ?? [];
    if (trends.length > 0) {
      return textileFromTrends(trends);
    }

    return null;
  }, [panQuery.data, trendsData]);

  const personalTextile = useMemo<TextileState | null>(() => {
    if (!globalTextile || !followingQuery.data) return null;
    return filterTextileByFollows(globalTextile, followingQuery.data);
  }, [globalTextile, followingQuery.data]);

  const gapAnalysis = useMemo<GapAnalysis | null>(() => {
    if (!globalTextile || !personalTextile) return null;
    return computeGapAnalysis(globalTextile, personalTextile);
  }, [globalTextile, personalTextile]);

  // Build a gap-view textile that highlights differences
  const gapTextile = useMemo<TextileState | null>(() => {
    if (!globalTextile || !gapAnalysis) return null;

    const gapThreads = [
      ...gapAnalysis.missing.map((g) => ({
        ...g.thread,
        // Missing threads rendered with high opacity and shifted hue
        opacity: 0.9,
      })),
      ...gapAnalysis.unique.map((g) => ({
        ...g.thread,
        opacity: 0.9,
      })),
      ...gapAnalysis.amplified.map((g) => ({
        ...g.thread,
        opacity: 0.7,
      })),
      ...gapAnalysis.diminished.map((g) => ({
        ...g.thread,
        opacity: 0.5,
      })),
    ];

    const gapReport = generateGapReport(gapAnalysis);

    return {
      threads: gapThreads,
      crossings: [],
      luminance: globalTextile.luminance * 0.6,
      saturation: 0.8,
      weatherReport: gapReport,
      timestamp: Date.now(),
      source: globalTextile.source,
    };
  }, [globalTextile, gapAnalysis]);

  // ─── Active Textile (based on view mode) ─────────────

  const activeTextile = useMemo<TextileState | null>(() => {
    switch (viewMode) {
      case "global":
        return globalTextile;
      case "personal":
        return personalTextile;
      case "gap":
        return gapTextile;
      default:
        return globalTextile;
    }
  }, [viewMode, globalTextile, personalTextile, gapTextile]);

  // ─── View Mode Controls ──────────────────────────────

  const cycleViewMode = useCallback(() => {
    setViewMode((current) => {
      const idx = VIEW_CYCLE.indexOf(current);
      return VIEW_CYCLE[(idx + 1) % VIEW_CYCLE.length];
    });
  }, []);

  return {
    viewMode,
    globalTextile,
    personalTextile,
    gapAnalysis,
    activeTextile,
    isLoading: panQuery.isLoading,
    error: panQuery.error instanceof Error ? panQuery.error : null,
    cycleViewMode,
    setViewMode,
  };
}

// ─── Gap Report ──────────────────────────────────────────

function generateGapReport(gap: GapAnalysis): string {
  const parts: string[] = [];

  if (gap.missing.length > 0) {
    parts.push(
      `${gap.missing.length} conversation${gap.missing.length === 1 ? "" : "s"} you're missing`,
    );
  }

  if (gap.unique.length > 0) {
    parts.push(
      `${gap.unique.length} thread${gap.unique.length === 1 ? "" : "s"} only your network sees`,
    );
  }

  if (gap.amplified.length > 0) {
    parts.push(`${gap.amplified.length} amplified in your view`);
  }

  if (parts.length === 0) {
    return `Your view closely mirrors the network (${Math.round(gap.overlapScore * 100)}% overlap).`;
  }

  return (
    parts.join(" · ") +
    ` · ${Math.round(gap.overlapScore * 100)}% overlap with the world.`
  );
}
