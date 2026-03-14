/**
 * Hook for fetching and caching network weather state.
 * Drives the ambient textile background behind the feed.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchNetworkWeather,
  WEATHER_CACHE_TTL,
  type NetworkWeatherState,
} from "../services/network-weather-service";

export function useNetworkWeather(enabled: boolean = true) {
  return useQuery({
    queryKey: ["networkWeather"],
    queryFn: fetchNetworkWeather,
    staleTime: WEATHER_CACHE_TTL,
    gcTime: WEATHER_CACHE_TTL * 3,
    enabled,
    refetchOnWindowFocus: false,
    refetchInterval: WEATHER_CACHE_TTL,
  });
}

export type { NetworkWeatherState };
export type { EmergenceState, EmergentThread } from "../services/network-weather-service";
