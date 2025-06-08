/**
 * React component wrappers for error tracking
 */

import React, { useEffect } from 'react';
import { trackError } from '../../lib/error-tracking';

/**
 * Hook to track component mount errors
 */
export function useErrorTracking(componentName: string) {
  useEffect(() => {
    // Track any errors that occur during the component lifecycle
    const handleError = (event: ErrorEvent) => {
      trackError(event.error, {
        category: 'ui',
        action: `${componentName} runtime error`,
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [componentName]);
}

/**
 * Wrapper for async operations in components
 */
export async function trackComponentAsync<T>(
  operation: () => Promise<T>,
  componentName: string,
  action: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    trackError(error, {
      category: 'ui',
      action: `${componentName}.${action}`
    });
    throw error;
  }
}