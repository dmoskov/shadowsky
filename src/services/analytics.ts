declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      config?: Record<string, any>
    ) => void
    dataLayer: any[]
  }
}

export class AnalyticsService {
  private static instance: AnalyticsService
  private measurementId: string = 'G-M2YCCZRDMN'
  private isInitialized: boolean = false

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  initialize(measurementId?: string) {
    if (measurementId) {
      this.measurementId = measurementId
    }
    this.isInitialized = true
  }

  private gtag(...args: any[]) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag(...args)
    }
  }

  // Page view tracking
  trackPageView(pagePath: string, pageTitle?: string) {
    if (!this.isInitialized) return

    this.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    })
  }

  // Custom event tracking
  trackEvent(eventName: string, parameters?: Record<string, any>) {
    if (!this.isInitialized) return

    this.gtag('event', eventName, {
      ...parameters,
      event_category: parameters?.category || 'engagement',
      event_label: parameters?.label,
      value: parameters?.value,
    })
  }

  // User authentication events
  trackLogin(method: string) {
    this.trackEvent('login', {
      method,
      category: 'authentication',
    })
  }

  trackLogout() {
    this.trackEvent('logout', {
      category: 'authentication',
    })
  }

  // Content interaction events
  trackPostView(postId: string, authorDid?: string) {
    this.trackEvent('view_item', {
      item_id: postId,
      item_category: 'post',
      author_id: authorDid,
      category: 'content',
    })
  }

  trackPostEngagement(action: 'like' | 'repost' | 'reply', postId: string) {
    this.trackEvent('post_engagement', {
      action,
      item_id: postId,
      category: 'engagement',
    })
  }

  // Feed interactions
  trackFeedScroll(depth: number) {
    this.trackEvent('feed_scroll', {
      scroll_depth: depth,
      category: 'navigation',
    })
  }

  trackFeedRefresh() {
    this.trackEvent('feed_refresh', {
      category: 'navigation',
    })
  }

  // Search events
  trackSearch(searchTerm: string, resultCount?: number) {
    this.trackEvent('search', {
      search_term: searchTerm,
      results_count: resultCount,
      category: 'search',
    })
  }

  // Error tracking
  trackError(errorMessage: string, errorStack?: string) {
    this.trackEvent('exception', {
      description: errorMessage,
      fatal: false,
      error_stack: errorStack,
      category: 'error',
    })
  }

  // User properties
  setUserProperties(properties: Record<string, any>) {
    if (!this.isInitialized) return

    this.gtag('set', 'user_properties', properties)
  }

  // Set user ID for cross-device tracking
  setUserId(userId: string) {
    if (!this.isInitialized) return

    this.gtag('config', this.measurementId, {
      user_id: userId,
    })
  }
}

export const analytics = AnalyticsService.getInstance()