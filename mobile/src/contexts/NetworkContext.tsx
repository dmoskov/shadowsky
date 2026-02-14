/**
 * Network Context
 *
 * Provides network status information and utilities to the entire app.
 *
 * Features:
 * - Real-time network status monitoring
 * - Online/offline state management
 * - Wait for connection promise
 * - Reconnection callbacks
 * - Offline banner display
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import OfflineBanner from "../components/OfflineBanner";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import type { NetworkStatus } from "../hooks/useNetworkStatus";


import { createLogger } from '../utils/logger';

const logger = createLogger('Networkcontextx');
interface NetworkContextType extends NetworkStatus {
  isOnline: boolean;
  waitForConnection: () => Promise<void>;
  onReconnect: (callback: () => void) => () => void;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const networkStatus = useNetworkStatus();
  const reconnectCallbacks = useRef<Set<() => void>>(new Set());
  const waitingPromises = useRef<Set<(value: void) => void>>(new Set());
  const previousOnlineState = useRef<boolean>(networkStatus.isConnected);

  // Derive simple online state
  const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable !== false;

  // Detect when connection is restored and call callbacks
  useEffect(() => {
    const wasOffline = !previousOnlineState.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      // Connection restored - call all reconnect callbacks
      reconnectCallbacks.current.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          logger.error('Error in reconnect callback:', error);
        }
      });

      // Resolve all waiting promises
      waitingPromises.current.forEach((resolve) => {
        resolve();
      });
      waitingPromises.current.clear();
    }

    previousOnlineState.current = isOnline;
  }, [isOnline]);

  /**
   * Returns a promise that resolves when the connection is restored.
   * If already online, resolves immediately.
   *
   * @example
   * ```tsx
   * await waitForConnection();
   * // Now we're online, proceed with network request
   * ```
   */
  const waitForConnection = useCallback((): Promise<void> => {
    if (isOnline) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      waitingPromises.current.add(resolve);
    });
  }, [isOnline]);

  /**
   * Register a callback to be called when connection is restored.
   * Returns an unsubscribe function.
   *
   * @example
   * ```tsx
   * const unsubscribe = onReconnect(() => {
   *   logger.log('Back online!');
   *   refetch();
   * });
   *
   * // Later, to cleanup:
   * unsubscribe();
   * ```
   */
  const onReconnect = useCallback((callback: () => void): (() => void) => {
    reconnectCallbacks.current.add(callback);

    // Return unsubscribe function
    return () => {
      reconnectCallbacks.current.delete(callback);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      ...networkStatus,
      isOnline,
      waitForConnection,
      onReconnect,
    }),
    [networkStatus, isOnline, waitForConnection, onReconnect],
  );

  return (
    <NetworkContext.Provider value={contextValue}>
      <OfflineBanner isOnline={isOnline} />
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
