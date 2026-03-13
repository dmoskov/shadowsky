/**
 * NetworkWeatherLayer — Composable plaid background layer
 *
 * Wraps any content with the Network Weather plaid visualization
 * behind it. Provides the three-mode toggle (global/personal/gap)
 * and handles data fetching via useNetworkWeather.
 *
 * Usage:
 *   <NetworkWeatherLayer>
 *     <YourFeedContent />
 *   </NetworkWeatherLayer>
 *
 * Ref: docs/vision/network-weather.md
 */

import React from "react";
import { useNetworkWeather } from "../hooks/useNetworkWeather";
import { NetworkWeatherPlaid } from "./NetworkWeatherPlaid";

interface NetworkWeatherLayerProps {
  children: React.ReactNode;
  /** Whether the plaid is visible (0–1 for pull-to-reveal) */
  visibility?: number;
}

export const NetworkWeatherLayer: React.FC<NetworkWeatherLayerProps> = ({
  children,
  visibility = 0.15,
}) => {
  const weather = useNetworkWeather();

  return (
    <div className="relative">
      <NetworkWeatherPlaid
        textile={weather.activeTextile}
        viewMode={weather.viewMode}
        gapAnalysis={weather.gapAnalysis}
        onCycleView={weather.cycleViewMode}
        onSetView={weather.setViewMode}
        isLoading={weather.isLoading}
        visibility={visibility}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
};
