/**
 * Request deduplication to prevent multiple identical requests
 * Useful for preventing duplicate API calls during HMR or rapid component updates
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private readonly maxAge = 5000; // 5 seconds max cache for pending requests
  
  /**
   * Deduplicate a request - if an identical request is already in flight,
   * return the existing promise instead of making a new request
   */
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Clean up old pending requests
    this.cleanupOldRequests();
    
    // Check if we have a pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      // Return the existing promise
      return pending.promise;
    }
    
    // Create new request
    const promise = requestFn()
      .finally(() => {
        // Remove from pending when complete
        this.pendingRequests.delete(key);
      });
    
    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });
    
    return promise;
  }
  
  /**
   * Clean up requests older than maxAge
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.maxAge) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.pendingRequests.delete(key));
  }
  
  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }
  
  /**
   * Get the number of pending requests
   */
  get size(): number {
    this.cleanupOldRequests();
    return this.pendingRequests.size;
  }
}

// Create a singleton instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Wrap an async function with request deduplication
 */
export function withDeduplication<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    return requestDeduplicator.deduplicate(key, () => fn(...args));
  }) as T;
}