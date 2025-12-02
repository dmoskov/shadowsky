import { debug } from "@bsky/shared";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";

export const NotificationPermissionPrompt: React.FC = () => {
  const { status, isLoading, subscribe, isDismissed, setDismissed } =
    usePushNotifications();

  const [show, setShow] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Ref to track the previously focused element for focus restoration
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const enableButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Don't show if not supported or already subscribed/denied
    if (!status.isSupported) {
      debug.log("Push notifications not supported");
      return;
    }

    if (status.permission === "denied") {
      debug.log("Push notifications denied");
      return;
    }

    if (status.isSubscribed || status.permission === "granted") {
      debug.log("Push notifications already enabled");
      return;
    }

    // Don't show if dismissed
    if (isDismissed) {
      return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      // Capture the currently focused element before showing the dialog
      previousFocusRef.current = document.activeElement as HTMLElement;
      setShow(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [status, isDismissed, isLoading]);

  // Focus the enable button when the prompt becomes visible
  useEffect(() => {
    if (show && enableButtonRef.current) {
      enableButtonRef.current.focus();
    }
  }, [show]);

  // Restore focus to the previously focused element
  const restoreFocus = useCallback(() => {
    if (
      previousFocusRef.current &&
      typeof previousFocusRef.current.focus === "function"
    ) {
      // Check if element is still in the DOM and focusable
      if (document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    }
  }, []);

  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      const success = await subscribe();

      if (success) {
        debug.log("Push notifications enabled successfully");
        setShow(false);
        restoreFocus();
      }
    } catch (error) {
      debug.error("Error enabling push notifications:", error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    restoreFocus();
  };

  // Don't render if loading, not showing, or not supported
  if (isLoading || !show || !status.isSupported) {
    return null;
  }

  // Don't show if permission is denied
  if (status.permission === "denied") {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 lg:bottom-4 lg:left-auto lg:right-4 lg:w-96">
      <div
        className="rounded-lg border p-4 shadow-lg"
        style={{
          background: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border)",
        }}
        role="dialog"
        aria-labelledby="notification-prompt-title"
        aria-describedby="notification-prompt-description"
      >
        <div className="flex items-start gap-3">
          <div
            className="rounded-full p-2"
            style={{
              background: "var(--bsky-primary)",
              color: "white",
            }}
            aria-hidden="true"
          >
            <Bell className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <h3
              id="notification-prompt-title"
              className="mb-1 font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Enable Push Notifications
            </h3>
            <p
              id="notification-prompt-description"
              className="mb-3 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Get notified about likes, replies, and mentions even when the app
              is closed
            </p>

            <div className="flex gap-2">
              <button
                ref={enableButtonRef}
                onClick={handleEnable}
                disabled={isSubscribing}
                className="flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                style={{
                  background: "var(--bsky-primary)",
                  color: "white",
                  // @ts-expect-error CSS custom property for focus ring
                  "--tw-ring-color": "var(--bsky-primary)",
                  "--tw-ring-offset-color": "var(--bsky-bg-secondary)",
                }}
                aria-busy={isSubscribing}
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  "Enable"
                )}
              </button>
              <button
                onClick={handleDismiss}
                disabled={isSubscribing}
                className="rounded px-3 py-2 text-sm font-medium transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  background: "var(--bsky-bg-tertiary)",
                  color: "var(--bsky-text-secondary)",
                  // @ts-expect-error CSS custom property for focus ring
                  "--tw-ring-color": "var(--bsky-primary)",
                  "--tw-ring-offset-color": "var(--bsky-bg-secondary)",
                }}
              >
                Not Now
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Dismiss notification prompt"
            style={{
              // @ts-expect-error CSS custom property for focus ring
              "--tw-ring-color": "var(--bsky-primary)",
              "--tw-ring-offset-color": "var(--bsky-bg-secondary)",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Component for showing when notifications are blocked
 */
export const NotificationBlockedBanner: React.FC = () => {
  const { status } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || status.permission !== "denied") {
    return null;
  }

  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-lg border p-3"
      style={{
        background: "var(--bsky-bg-tertiary)",
        borderColor: "var(--bsky-border)",
      }}
      role="alert"
    >
      <BellOff
        className="h-5 w-5 flex-shrink-0"
        style={{ color: "var(--bsky-text-secondary)" }}
      />
      <div className="flex-1">
        <p className="text-sm" style={{ color: "var(--bsky-text-secondary)" }}>
          Notifications are blocked. To enable them, update your browser
          settings for this site.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-400 hover:text-gray-600"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
