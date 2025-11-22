/**
 * API Retry Wrapper
 *
 * Wraps service methods with retry logic automatically
 */

import { RetryClient, RetryOptions } from "./retry-client";

export function createRetryWrapper(retryClient: RetryClient) {
  return {
    wrap<T extends (...args: any[]) => Promise<any>>(
      fn: T,
      options?: RetryOptions,
    ): T {
      return (async (...args: any[]) => {
        return retryClient.execute(() => fn(...args), options);
      }) as T;
    },

    wrapService<T extends object>(service: T, methodNames: (keyof T)[]): T {
      const wrapped = { ...service };

      for (const methodName of methodNames) {
        const original = service[methodName];
        if (typeof original === "function") {
          (wrapped as any)[methodName] = async function (
            this: any,
            ...args: any[]
          ) {
            return retryClient.execute(() => original.apply(this, args));
          };
        }
      }

      return wrapped;
    },
  };
}
