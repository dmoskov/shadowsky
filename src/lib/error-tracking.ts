/**
 * Lightweight error tracking for local development
 * Provides categorized console output with visual distinction
 */

export type ErrorCategory = 'auth' | 'network' | 'ui' | 'data' | 'unknown';

interface ErrorContext {
  category: ErrorCategory;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

class ErrorTracker {
  private readonly colors: Record<ErrorCategory, string> = {
    auth: '#ff4444',      // Red for auth issues
    network: '#ff8800',   // Orange for network issues
    ui: '#ffdd00',        // Yellow for UI errors
    data: '#ff00ff',      // Magenta for data errors
    unknown: '#888888'    // Gray for unknown
  };

  private readonly icons: Record<ErrorCategory, string> = {
    auth: '🔐',
    network: '🌐',
    ui: '🖼️',
    data: '📊',
    unknown: '❓'
  };

  /**
   * Track an error with context
   */
  track(error: Error | unknown, context: ErrorContext): void {
    const timestamp = new Date().toISOString();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const icon = this.icons[context.category];
    const color = this.colors[context.category];

    // Build error info
    const errorInfo = {
      timestamp,
      category: context.category,
      action: context.action,
      message: errorObj.message,
      stack: errorObj.stack,
      metadata: context.metadata
    };

    // Console output with styling
    console.group(
      `%c${icon} [${context.category.toUpperCase()}] ${timestamp}`,
      `color: ${color}; font-weight: bold; font-size: 12px`
    );
    
    console.error('%cError:', 'font-weight: bold', errorObj.message);
    
    if (context.action) {
      console.log('%cAction:', 'font-weight: bold', context.action);
    }
    
    if (context.metadata) {
      console.log('%cMetadata:', 'font-weight: bold', context.metadata);
    }
    
    if (errorObj.stack) {
      console.log('%cStack:', 'font-weight: bold');
      console.log(errorObj.stack);
    }
    
    console.groupEnd();

    // In development, also check for common issues
    this.checkCommonIssues(errorObj, context);
  }

  /**
   * Track an async operation that might fail
   */
  async trackAsync<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.track(error, context);
      throw error;
    }
  }

  /**
   * Create a tracked version of a function
   */
  wrap<T extends (...args: any[]) => any>(
    fn: T,
    context: Omit<ErrorContext, 'action'>
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.track(error, { ...context, action: fn.name || 'anonymous' });
            throw error;
          });
        }
        return result;
      } catch (error) {
        this.track(error, { ...context, action: fn.name || 'anonymous' });
        throw error;
      }
    }) as T;
  }

  /**
   * Check for common development issues
   */
  private checkCommonIssues(error: Error, context: ErrorContext): void {
    // Auth token expiry hint
    if (context.category === 'auth' && error.message.includes('expired')) {
      console.warn(
        '%c💡 Hint: Try logging out and back in to refresh your session',
        'color: #00aaff; font-style: italic'
      );
    }

    // Rate limit hint
    if (context.category === 'network' && error.message.includes('429')) {
      console.warn(
        '%c💡 Hint: You hit a rate limit. Wait a few seconds before retrying',
        'color: #00aaff; font-style: italic'
      );
    }

    // CORS hint for local development
    if (context.category === 'network' && error.message.includes('CORS')) {
      console.warn(
        '%c💡 Hint: CORS error - ensure you\'re using the correct API endpoint',
        'color: #00aaff; font-style: italic'
      );
    }
  }

  /**
   * Get error stats for debugging patterns
   */
  getStats(): void {
    console.log(
      '%c📊 Error Tracking Stats',
      'color: #00aaff; font-weight: bold; font-size: 14px'
    );
    console.log('Stats tracking not implemented for local-only usage');
    console.log('Check your console history for error patterns');
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Export convenience functions
export const trackError = (error: Error | unknown, context: ErrorContext) =>
  errorTracker.track(error, context);

export const trackAsync = <T>(
  operation: () => Promise<T>,
  context: ErrorContext
) => errorTracker.trackAsync(operation, context);

export const wrapWithTracking = <T extends (...args: any[]) => any>(
  fn: T,
  context: Omit<ErrorContext, 'action'>
) => errorTracker.wrap(fn, context);

// Re-export types for better module resolution
export type { ErrorContext };