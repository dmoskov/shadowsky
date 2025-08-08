import { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { analytics } from "../services/analytics";

// Hook for automatic page tracking
export function usePageTracking() {
  const location = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    // Set user ID if available
    if (session?.did) {
      analytics.setUserId(session.did);
    }

    // Track page view
    analytics.trackPageView(location.pathname);
  }, [location.pathname, session?.did]);
}

// Hook for tracking component performance
export function usePerformanceTracking(componentName: string) {
  const startTime = Date.now();

  useEffect(() => {
    return () => {
      const duration = Date.now() - startTime;
      analytics.trackTiming(
        "component_lifecycle",
        "render_duration",
        duration,
        componentName,
      );
    };
  }, [componentName, startTime]);
}

// Hook for tracking user interactions
export function useInteractionTracking() {
  const trackClick = useCallback(
    (element: string, metadata?: Record<string, any>) => {
      analytics.trackUIInteraction(element, "click");
      if (metadata) {
        analytics.trackEvent({
          category: "ui_interaction",
          action: "click_with_metadata",
          label: element,
          custom_parameters: metadata,
        });
      }
    },
    [],
  );

  const trackHover = useCallback((element: string) => {
    analytics.trackUIInteraction(element, "hover");
  }, []);

  const trackScroll = useCallback(
    (element: string, scrollPercentage: number) => {
      analytics.trackEvent({
        category: "ui_interaction",
        action: "scroll",
        label: element,
        value: Math.round(scrollPercentage),
      });
    },
    [],
  );

  return { trackClick, trackHover, trackScroll };
}

// Hook for tracking errors
export function useErrorTracking() {
  const trackError = useCallback((error: Error, context?: string) => {
    analytics.trackError(error, context);
  }, []);

  // Set up global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackError(new Error(event.message), "global_error_handler");
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackError(
        new Error(String(event.reason)),
        "unhandled_promise_rejection",
      );
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, [trackError]);

  return { trackError };
}

// Hook for tracking feature usage
export function useFeatureTracking(featureName: string) {
  useEffect(() => {
    analytics.trackFeatureUsage(featureName, "viewed");
  }, [featureName]);

  const trackFeatureAction = useCallback(
    (action: string, metadata?: Record<string, any>) => {
      analytics.trackEvent({
        category: "features",
        action: `${featureName}_${action}`,
        custom_parameters: metadata,
      });
    },
    [featureName],
  );

  return { trackFeatureAction };
}

// Hook for tracking notification metrics
export function useNotificationTracking() {
  const trackNotificationLoad = useCallback(
    (duration: number, count: number, source: "cache" | "api") => {
      analytics.trackNotificationLoad(duration, count, source);
    },
    [],
  );

  const trackNotificationInteraction = useCallback(
    (action: string, notificationType: string) => {
      analytics.trackNotificationInteraction(action, notificationType);
    },
    [],
  );

  const trackNotificationView = useCallback((type: string, count: number) => {
    analytics.trackNotificationView(type, count);
  }, []);

  return {
    trackNotificationLoad,
    trackNotificationInteraction,
    trackNotificationView,
  };
}

// Hook for tracking conversation metrics
export function useConversationTracking() {
  const trackConversationView = useCallback(
    (conversationId: string, messageCount: number) => {
      analytics.trackConversationView(conversationId, messageCount);
    },
    [],
  );

  const trackConversationAction = useCallback((action: string) => {
    analytics.trackConversationInteraction(action);
  }, []);

  return {
    trackConversationView,
    trackConversationAction,
  };
}

// Hook for tracking search behavior
export function useSearchTracking() {
  const trackSearch = useCallback((query: string, resultCount: number) => {
    analytics.trackSearch(query, resultCount);
  }, []);

  return { trackSearch };
}
