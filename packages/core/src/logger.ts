/**
 * Pluggable logger for @bsky/core.
 *
 * Core must not depend on a platform-specific logger (web's debug gates on
 * localStorage; mobile has its own). Each app injects its logger via
 * `setLogger(...)`. The default is a no-op, which matches the web `debug`
 * default (silent unless debug mode is enabled), so forgetting to wire it does
 * not spam logs.
 */
export interface Logger {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
}

const noop = () => {};

let current: Logger = {
  log: noop,
  error: noop,
  warn: noop,
  info: noop,
};

/** Inject the host application's logger. Call once at startup. */
export function setLogger(impl: Logger): void {
  current = impl;
}

/** The logger used throughout @bsky/core. Delegates to the injected impl. */
export const logger: Logger = {
  log: (...args) => current.log(...args),
  error: (...args) => current.error(...args),
  warn: (...args) => current.warn(...args),
  info: (...args) => current.info(...args),
};
