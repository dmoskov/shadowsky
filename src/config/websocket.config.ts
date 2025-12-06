/**
 * WebSocket Configuration
 *
 * Centralized configuration for all WebSocket-related timing and limits.
 * These values control connection behavior, reconnection logic, and polling intervals.
 */

export const WS_CONFIG = {
  /**
   * Maximum time to wait for authentication response after connecting.
   * If no auth_success/auth_failure is received within this time, connection is considered failed.
   */
  AUTH_TIMEOUT_MS: 10000,

  /**
   * Initial delay before attempting to reconnect after a connection failure.
   * This value is used as the base for exponential backoff calculations.
   */
  INITIAL_RECONNECT_DELAY_MS: 5000,

  /**
   * Maximum delay between reconnection attempts.
   * Exponential backoff will not exceed this value.
   */
  MAX_RECONNECT_DELAY_MS: 30000,

  /**
   * Maximum number of reconnection attempts before giving up.
   * After this many failures, the connection state changes to ERROR.
   */
  MAX_RECONNECT_ATTEMPTS: 10,

  /**
   * Interval between heartbeat (ping) messages when connected.
   * Heartbeats keep the connection alive and detect silent disconnections.
   */
  HEARTBEAT_INTERVAL_MS: 30000,

  /**
   * Maximum time to wait for PONG response after sending PING.
   * If no PONG is received within this time, the connection is considered a zombie
   * (TCP alive but server unresponsive) and will be reconnected.
   */
  PONG_TIMEOUT_MS: 10000,

  /**
   * Polling interval for connection stats when WebSocket is connected.
   * Longer interval since real-time events handle most updates.
   */
  STATS_POLL_CONNECTED_MS: 30000,

  /**
   * Polling interval for connection stats when WebSocket is disconnected or reconnecting.
   * Shorter interval to provide faster feedback on connection status changes.
   */
  STATS_POLL_DISCONNECTED_MS: 5000,

  /**
   * Debounce delay for batching notification updates to React Query.
   * Multiple notifications within this window are combined into a single update.
   */
  NOTIFICATION_DEBOUNCE_MS: 100,

  /**
   * Delay before reconnecting after a manual reconnect is triggered.
   * Allows the disconnect to complete cleanly.
   */
  MANUAL_RECONNECT_DELAY_MS: 1000,
} as const;

/**
 * Type representing the WebSocket configuration object.
 * Useful for creating test utilities that override config values.
 *
 * @example
 * // In tests, you can create partial overrides:
 * const testConfig: Partial<WSConfig> = {
 *   AUTH_TIMEOUT_MS: 100,
 *   MAX_RECONNECT_ATTEMPTS: 2,
 * };
 */
export type WSConfig = typeof WS_CONFIG;

/**
 * Type for individual config keys, useful for type-safe access.
 */
export type WSConfigKey = keyof WSConfig;
