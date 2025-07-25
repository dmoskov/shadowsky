/**
 * Enhanced error tracking for local development
 * Features:
 * - Categorized console output with visual distinction
 * - Error deduplication to reduce console spam
 * - Session storage for error history
 * - Quick error summary via keyboard shortcut
 */

export type ErrorCategory = 'auth' | 'network' | 'ui' | 'data' | 'unknown';

interface ErrorContext {
  category: ErrorCategory;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface ErrorRecord {
  timestamp: string;
  category: ErrorCategory;
  message: string;
  stack?: string;
  action?: string;
  metadata?: Record<string, any>;
  count: number;
  lastSeen: string;
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

  private errors: Map<string, ErrorRecord> = new Map();
  private sessionStartTime = Date.now();
  private readonly MAX_ERRORS = 100; // Keep last 100 unique errors

  /**
   * Track an error with context
   */
  track(error: Error | unknown, context: ErrorContext): void {
    const timestamp = new Date().toISOString();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const icon = this.icons[context.category];
    const color = this.colors[context.category];

    // Create error key for deduplication
    const errorKey = `${context.category}:${errorObj.message}:${context.action || 'unknown'}`;
    
    // Check if we've seen this error before
    const existingError = this.errors.get(errorKey);
    const isRepeat = !!existingError;
    
    if (isRepeat) {
      // Update existing error record
      existingError!.count++;
      existingError!.lastSeen = timestamp;
    } else {
      // Create new error record
      const errorRecord: ErrorRecord = {
        timestamp,
        category: context.category,
        message: errorObj.message,
        stack: errorObj.stack,
        action: context.action,
        metadata: context.metadata,
        count: 1,
        lastSeen: timestamp
      };
      
      this.errors.set(errorKey, errorRecord);
      
      // Limit stored errors
      if (this.errors.size > this.MAX_ERRORS) {
        const firstKey = this.errors.keys().next().value;
        if (firstKey) {
          this.errors.delete(firstKey);
        }
      }
    }

    // Console output with styling
    const headerText = isRepeat 
      ? `${icon} [${context.category.toUpperCase()}] ${errorObj.message} (×${existingError!.count})`
      : `${icon} [${context.category.toUpperCase()}] ${timestamp}`;
    
    console.group(
      `%c${headerText}`,
      `color: ${color}; font-weight: bold; font-size: 12px`
    );
    
    if (!isRepeat) {
      console.error('%cError:', 'font-weight: bold', errorObj.message);
      
      if (context.action) {
        console.log('%cAction:', 'font-weight: bold', context.action);
      }
      
      if (context.metadata) {
        console.log('%cMetadata:', 'font-weight: bold', context.metadata);
      }
      
      if (errorObj.stack) {
        // Format stack trace for better readability
        const formattedStack = this.formatStackTrace(errorObj.stack);
        console.log('%cStack:', 'font-weight: bold');
        console.log(formattedStack);
      }
    } else {
      console.log(`%cRepeated ${existingError!.count} times. Last seen: ${existingError!.lastSeen}`, 'color: #666; font-style: italic');
    }
    
    console.groupEnd();

    // In development, also check for common issues
    if (!isRepeat) {
      this.checkCommonIssues(errorObj, context);
    }
  }

  /**
   * Format stack trace for better readability
   */
  private formatStackTrace(stack: string): string {
    // Remove error message from stack (first line)
    const lines = stack.split('\n').slice(1);
    
    // Format each line
    return lines
      .map(line => {
        // Highlight our code vs node_modules
        if (line.includes('node_modules')) {
          return `  ${line.trim()} (external)`;
        }
        return `  → ${line.trim()}`;
      })
      .join('\n');
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
   * Get error summary for debugging patterns
   */
  getSummary(): void {
    const sessionTime = Date.now() - this.sessionStartTime;
    const sessionMinutes = Math.floor(sessionTime / 60000);
    
    console.group(
      '%c🐛 Error Summary',
      'color: #00aaff; font-weight: bold; font-size: 16px; padding: 4px 0'
    );
    
    console.log(`%cSession Duration: ${sessionMinutes} minutes`, 'color: #666');
    console.log(`%cTotal Unique Errors: ${this.errors.size}`, 'color: #666');
    
    // Group errors by category
    const errorsByCategory = new Map<ErrorCategory, ErrorRecord[]>();
    this.errors.forEach((error) => {
      const list = errorsByCategory.get(error.category) || [];
      list.push(error);
      errorsByCategory.set(error.category, list);
    });
    
    // Display errors by category
    errorsByCategory.forEach((errors, category) => {
      const icon = this.icons[category];
      const color = this.colors[category];
      const totalCount = errors.reduce((sum, e) => sum + e.count, 0);
      
      console.group(
        `%c${icon} ${category.toUpperCase()} (${errors.length} unique, ${totalCount} total)`,
        `color: ${color}; font-weight: bold; margin-top: 8px`
      );
      
      // Sort by count (most frequent first)
      errors
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Show top 5
        .forEach((error) => {
          console.log(
            `%c  ${error.count}× ${error.message}`,
            'color: #333',
            error.action ? `[${error.action}]` : ''
          );
        });
      
      if (errors.length > 5) {
        console.log(`%c  ... and ${errors.length - 5} more`, 'color: #999; font-style: italic');
      }
      
      console.groupEnd();
    });
    
    console.groupEnd();
  }
  
  /**
   * Clear all tracked errors
   */
  clearErrors(): void {
    this.errors.clear();
    console.log('%c🧹 Error history cleared', 'color: #00aaff; font-style: italic');
  }
  
  /**
   * Get error count by category
   */
  getErrorCount(category?: ErrorCategory): number {
    if (category) {
      let count = 0;
      this.errors.forEach((error) => {
        if (error.category === category) {
          count += error.count;
        }
      });
      return count;
    }
    
    // Total count
    let total = 0;
    this.errors.forEach((error) => {
      total += error.count;
    });
    return total;
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

// Development utilities
export const getErrorSummary = () => errorTracker.getSummary();
export const clearErrors = () => errorTracker.clearErrors();
export const getErrorCount = (category?: ErrorCategory) => errorTracker.getErrorCount(category);

// Make error tracker available globally in development
// @ts-ignore - import.meta.env is provided by Vite
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as any).errorTracker = {
    summary: getErrorSummary,
    clear: clearErrors,
    count: getErrorCount,
    // Shortcuts
    s: getErrorSummary,
    c: clearErrors
  };
  
  console.log(
    '%c🐛 Error Tracker Available',
    'color: #00aaff; font-weight: bold',
    '\n  errorTracker.summary() or errorTracker.s() - Show error summary\n' +
    '  errorTracker.clear() or errorTracker.c() - Clear error history\n' +
    '  errorTracker.count(category?) - Get error count'
  );
}

// Re-export types for better module resolution
export type { ErrorContext };