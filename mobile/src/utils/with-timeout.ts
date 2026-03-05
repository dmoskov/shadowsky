/**
 * Timeout utilities for API calls
 *
 * Provides two mechanisms:
 * - withTimeout: Races any promise against a timeout (for SDK calls)
 * - fetchWithTimeout: Wraps fetch() with AbortController (for HTTP calls)
 */

/**
 * Error thrown when an operation exceeds its timeout
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise-returning function against a timeout.
 * Use for AT Protocol SDK calls (agent.*) where AbortController isn't supported.
 *
 * @param fn - Async function to execute
 * @param ms - Timeout in milliseconds
 * @returns The result of fn()
 * @throws TimeoutError if the operation exceeds the timeout
 */
export function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new TimeoutError(ms));
      }
    }, ms);

    fn().then(
      (result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      },
    );
  });
}

/**
 * Wrapper around fetch() that adds an AbortController-based timeout.
 * Properly cancels the HTTP request when the timeout fires.
 *
 * @param input - URL or Request object
 * @param init - Fetch options (headers, method, body, etc.)
 * @param timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns The fetch Response
 * @throws TimeoutError if the request exceeds the timeout
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
