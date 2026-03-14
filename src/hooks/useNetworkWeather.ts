/**
 * Hook for network weather state on web.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchNetworkWeather,
  WEATHER_CACHE_TTL,
  type NetworkWeatherState,
} from "../services/network-weather";

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
