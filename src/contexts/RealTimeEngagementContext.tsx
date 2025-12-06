/**
 * Real-Time Engagement Context
 *
 * Provides app-wide access to real-time engagement updates.
 * Initializes the engagement service when WebSocket is connected.
 */

import React, { createContext, useContext, useEffect } from "react";
import {
  useRealTimeEngagement,
  type UseRealTimeEngagementReturn,
} from "../hooks/useRealTimeEngagement";
import {
  cleanupEngagementService,
  getRealTimeEngagementService,
  initializeEngagementService,
} from "../services/real-time-engagement-service";

/**
 * Context value type - same as the return type of useRealTimeEngagement hook
 */
type RealTimeEngagementContextValue = UseRealTimeEngagementReturn;

const RealTimeEngagementContext =
  createContext<RealTimeEngagementContextValue | null>(null);

/**
 * Provider props
 */
interface RealTimeEngagementProviderProps {
  children: React.ReactNode;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Provider component that initializes and manages the engagement service
 */
export const RealTimeEngagementProvider: React.FC<
  RealTimeEngagementProviderProps
> = ({ children, debug = false }) => {
  // Initialize service on mount
  useEffect(() => {
    const service = getRealTimeEngagementService();
    if (service.isEnabled()) {
      initializeEngagementService();
    }

    return () => {
      cleanupEngagementService();
    };
  }, []);

  // Use the hook to get all engagement functionality
  const engagementState = useRealTimeEngagement({
    autoTrackViewport: true,
    debug,
  });

  return (
    <RealTimeEngagementContext.Provider value={engagementState}>
      {children}
    </RealTimeEngagementContext.Provider>
  );
};

/**
 * Hook to access real-time engagement context
 */
export function useRealTimeEngagementContext(): RealTimeEngagementContextValue {
  const context = useContext(RealTimeEngagementContext);
  if (!context) {
    throw new Error(
      "useRealTimeEngagementContext must be used within RealTimeEngagementProvider",
    );
  }
  return context;
}

/**
 * Optional hook that returns null if not within provider
 */
export function useRealTimeEngagementContextOptional(): RealTimeEngagementContextValue | null {
  return useContext(RealTimeEngagementContext);
}

export default RealTimeEngagementContext;
