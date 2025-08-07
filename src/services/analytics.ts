// Google Analytics service for tracking user behavior and app usage

declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

export interface AnalyticsEvent {
  category: string
  action: string
  label?: string
  value?: number
  custom_parameters?: Record<string, any>
}

class AnalyticsService {
  private initialized = false
  private userId: string | null = null

  initialize(measurementId: string) {
    if (this.initialized || !measurementId) return

    
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []
    window.gtag = function() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      send_page_view: false, // We'll manually track page views
      debug_mode: import.meta.env.DEV // Enable debug in development
    })

    this.initialized = true
  }

  // Set user ID for tracking across sessions
  setUserId(userId: string | null) {
    this.userId = userId
    if (userId) {
      window.gtag('set', { user_id: userId })
    }
  }

  // Track page views
  trackPageView(path: string, title?: string) {
    if (!this.initialized) return

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      user_id: this.userId
    })
  }

  // Track custom events
  trackEvent(event: AnalyticsEvent) {
    if (!this.initialized) return

    const parameters: Record<string, any> = {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      user_id: this.userId,
      ...event.custom_parameters
    }

    window.gtag('event', event.action, parameters)
  }

  // Authentication events
  trackLogin(method: string = 'bluesky') {
    this.trackEvent({
      category: 'authentication',
      action: 'login',
      label: method
    })
  }

  trackLogout() {
    this.trackEvent({
      category: 'authentication',
      action: 'logout'
    })
  }

  // Notification events
  trackNotificationView(type: string, count: number) {
    this.trackEvent({
      category: 'notifications',
      action: 'view',
      label: type,
      value: count
    })
  }

  trackNotificationInteraction(action: string, notificationType: string) {
    this.trackEvent({
      category: 'notifications',
      action: `notification_${action}`,
      label: notificationType
    })
  }

  trackNotificationLoad(duration: number, count: number, source: 'cache' | 'api') {
    this.trackEvent({
      category: 'performance',
      action: 'notification_load',
      label: source,
      value: duration,
      custom_parameters: {
        notification_count: count
      }
    })
  }

  // Conversation events
  trackConversationView(conversationId: string, messageCount: number) {
    this.trackEvent({
      category: 'conversations',
      action: 'view',
      label: conversationId,
      value: messageCount
    })
  }

  trackConversationInteraction(action: string) {
    this.trackEvent({
      category: 'conversations',
      action: `conversation_${action}`
    })
  }

  // Analytics page events
  trackAnalyticsView(chartType: string) {
    this.trackEvent({
      category: 'analytics',
      action: 'view_chart',
      label: chartType
    })
  }

  trackAnalyticsInteraction(action: string, metric?: string) {
    this.trackEvent({
      category: 'analytics',
      action: `analytics_${action}`,
      label: metric
    })
  }

  // Performance metrics
  trackPerformance(metric: string, value: number, metadata?: Record<string, any>) {
    this.trackEvent({
      category: 'performance',
      action: metric,
      value: Math.round(value),
      custom_parameters: metadata
    })
  }

  // Error tracking
  trackError(error: Error, context?: string) {
    this.trackEvent({
      category: 'errors',
      action: 'error_occurred',
      label: context || error.name,
      custom_parameters: {
        error_message: error.message,
        error_stack: error.stack?.substring(0, 500) // Limit stack trace length
      }
    })
  }

  // Feature usage
  trackFeatureUsage(feature: string, action: string = 'used') {
    this.trackEvent({
      category: 'features',
      action: `feature_${action}`,
      label: feature
    })
  }

  // Search events
  trackSearch(query: string, resultCount: number) {
    this.trackEvent({
      category: 'search',
      action: 'search_performed',
      label: query.substring(0, 100), // Limit query length
      value: resultCount
    })
  }

  // UI interactions
  trackUIInteraction(element: string, action: string) {
    this.trackEvent({
      category: 'ui_interaction',
      action: action,
      label: element
    })
  }

  // Session timing
  trackTiming(category: string, variable: string, value: number, label?: string) {
    if (!this.initialized) return

    window.gtag('event', 'timing_complete', {
      event_category: category,
      name: variable,
      value: Math.round(value),
      event_label: label
    })
  }

  // Custom dimensions
  setCustomDimension(index: number, value: string) {
    if (!this.initialized) return

    window.gtag('set', {
      [`custom_dimension_${index}`]: value
    })
  }
}

// Export singleton instance
export const analytics = new AnalyticsService()

// Export tracking hooks for React components
export const usePageTracking = () => {
  // This will be implemented as a React hook
}

// Helper to track component mount/unmount
export const trackComponentLifecycle = (componentName: string) => {
  analytics.trackEvent({
    category: 'components',
    action: 'component_mounted',
    label: componentName
  })

  return () => {
    analytics.trackEvent({
      category: 'components',
      action: 'component_unmounted',
      label: componentName
    })
  }
}