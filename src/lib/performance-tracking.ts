/**
 * Lightweight performance tracking for local development
 * Tracks Core Web Vitals and custom metrics with console output
 */

import React from 'react';
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
import type { Metric } from 'web-vitals';

interface PerformanceContext {
  route?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class PerformanceTracker {
  private readonly thresholds = {
    // Good thresholds based on Web Vitals standards
    LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
    CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
    FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
    TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
    INP: { good: 200, needsImprovement: 500 },   // Interaction to Next Paint
  };

  private readonly colors = {
    good: '#0cce6b',           // Green
    needsImprovement: '#ffa400', // Orange
    poor: '#ff4e42',           // Red
    info: '#00aaff',           // Blue
  };

  private customMetrics: Map<string, number> = new Map();
  private context: PerformanceContext = {};

  constructor() {
    // Only initialize web vitals in browser environment
    if (typeof window !== 'undefined' && typeof performance !== 'undefined' && performance.getEntriesByType) {
      this.initializeWebVitals();
      this.trackNavigationTiming();
    }
  }

  /**
   * Initialize Web Vitals tracking
   */
  private initializeWebVitals(): void {
    // Core Web Vitals
    onLCP(this.reportWebVital.bind(this));
    onCLS(this.reportWebVital.bind(this));
    onINP(this.reportWebVital.bind(this));
    
    // Additional metrics
    onFCP(this.reportWebVital.bind(this));
    onTTFB(this.reportWebVital.bind(this));
  }

  /**
   * Track navigation timing
   */
  private trackNavigationTiming(): void {
    if ('performance' in window && 'getEntriesByType' in window.performance) {
      // Wait for page load
      window.addEventListener('load', () => {
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navEntry) {
          console.group(
            '%c⚡ Navigation Performance',
            'color: #00aaff; font-weight: bold; font-size: 12px'
          );
          console.log('DNS Lookup:', Math.round(navEntry.domainLookupEnd - navEntry.domainLookupStart), 'ms');
          console.log('TCP Connection:', Math.round(navEntry.connectEnd - navEntry.connectStart), 'ms');
          console.log('Response Time:', Math.round(navEntry.responseEnd - navEntry.responseStart), 'ms');
          console.log('DOM Interactive:', Math.round(navEntry.domInteractive - navEntry.fetchStart), 'ms');
          console.log('DOM Complete:', Math.round(navEntry.domComplete - navEntry.fetchStart), 'ms');
          console.log('Total Load Time:', Math.round(navEntry.loadEventEnd - navEntry.fetchStart), 'ms');
          console.groupEnd();
        }
      });
    }
  }

  /**
   * Report Web Vital metric
   */
  private reportWebVital(metric: Metric): void {
    const rating = this.getRating(metric.name as keyof typeof this.thresholds, metric.value);
    const color = this.colors[rating];
    const icon = rating === 'good' ? '✅' : rating === 'needsImprovement' ? '⚠️' : '❌';

    console.group(
      `%c${icon} ${metric.name}: ${this.formatValue(metric.name, metric.value)}`,
      `color: ${color}; font-weight: bold; font-size: 12px`
    );
    
    console.log('%cRating:', 'font-weight: bold', rating);
    console.log('%cValue:', 'font-weight: bold', metric.value);
    
    if (this.context.route) {
      console.log('%cRoute:', 'font-weight: bold', this.context.route);
    }
    
    // Add helpful context for poor performance
    if (rating === 'poor') {
      this.logPerformanceHint(metric.name, metric.value);
    }
    
    console.groupEnd();
  }

  /**
   * Get rating for a metric value
   */
  private getRating(
    metricName: keyof typeof this.thresholds,
    value: number
  ): 'good' | 'needsImprovement' | 'poor' {
    const threshold = this.thresholds[metricName];
    if (!threshold) return 'good';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needsImprovement';
    return 'poor';
  }

  /**
   * Format metric value for display
   */
  private formatValue(metricName: string, value: number): string {
    if (metricName === 'CLS') {
      return value.toFixed(3);
    }
    return `${Math.round(value)}ms`;
  }

  /**
   * Log performance hints for poor metrics
   */
  private logPerformanceHint(metricName: string, value: number): void {
    const hints: Record<string, string> = {
      LCP: '💡 Hint: Large images or slow server response may be causing delays. Consider optimizing images and using CDN.',
      CLS: '💡 Hint: Elements shifting during load. Ensure images have dimensions and fonts are preloaded.',
      FCP: '💡 Hint: Initial render is slow. Check server response time and critical CSS.',
      TTFB: '💡 Hint: Server response is slow. Check API performance and caching.',
      INP: '💡 Hint: Interactions are sluggish. Profile JavaScript execution and optimize event handlers.',
    };

    if (hints[metricName]) {
      console.warn(
        hints[metricName],
        'color: #00aaff; font-style: italic'
      );
    }
  }

  /**
   * Set context for performance tracking
   */
  setContext(context: PerformanceContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Track a custom performance metric
   */
  trackCustomMetric(name: string, value: number, context?: PerformanceContext): void {
    this.customMetrics.set(name, value);
    
    console.log(
      `%c📊 Custom Metric: ${name} = ${Math.round(value)}ms`,
      'color: #00aaff; font-weight: bold'
    );
    
    if (context) {
      console.log('Context:', context);
    }
  }

  /**
   * Measure async operation performance
   */
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;
      this.trackCustomMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackCustomMetric(`${name} (failed)`, duration);
      throw error;
    }
  }

  /**
   * Create a performance mark
   */
  mark(name: string): void {
    performance.mark(name);
  }

  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    try {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
      
      const entries = performance.getEntriesByName(name, 'measure');
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry) {
        this.trackCustomMetric(name, lastEntry.duration);
      }
    } catch (error) {
      console.error('Performance measurement error:', error);
    }
  }

  /**
   * Get performance summary
   */
  getSummary(): void {
    console.group(
      '%c📈 Performance Summary',
      'color: #00aaff; font-weight: bold; font-size: 14px'
    );
    
    // Resource timing summary
    const resources = performance.getEntriesByType('resource');
    const resourcesByType = resources.reduce((acc, resource) => {
      const type = (resource as PerformanceResourceTiming).initiatorType;
      if (!acc[type]) acc[type] = 0;
      acc[type]++;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Resources loaded:', resources.length);
    console.log('By type:', resourcesByType);
    
    // Custom metrics
    if (this.customMetrics.size > 0) {
      console.log('\nCustom Metrics:');
      this.customMetrics.forEach((value, name) => {
        console.log(`  ${name}: ${Math.round(value)}ms`);
      });
    }
    
    console.groupEnd();
  }
}

// Export singleton instance
export const performanceTracker = new PerformanceTracker();

// Export convenience functions
export const trackPerformance = (name: string, value: number, context?: PerformanceContext) =>
  performanceTracker.trackCustomMetric(name, value, context);

export const measureAsync = <T>(name: string, operation: () => Promise<T>) =>
  performanceTracker.measureAsync(name, operation);

export const setPerformanceContext = (context: PerformanceContext) =>
  performanceTracker.setContext(context);

// React hook for component render tracking
export const useRenderTracking = (componentName: string) => {
  const renderCount = React.useRef(0);
  const renderStart = React.useRef(performance.now());
  
  React.useEffect(() => {
    renderCount.current++;
    const renderTime = performance.now() - renderStart.current;
    
    if (renderCount.current > 1) {
      performanceTracker.trackCustomMetric(
        `${componentName} re-render`,
        renderTime,
        { metadata: { count: renderCount.current } }
      );
    }
    
    renderStart.current = performance.now();
  });
};

