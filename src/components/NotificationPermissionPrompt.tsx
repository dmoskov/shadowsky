import { debug } from "@bsky/shared";
import { Bell, X } from "lucide-react";
import React, { useEffect, useState } from "react";

export const NotificationPermissionPrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if (!("Notification" in window)) {
      debug.log("Browser does not support notifications");
      return;
    }

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    const dismissedKey = "notification-permission-dismissed";
    const isDismissed = localStorage.getItem(dismissedKey) === "true";

    if (currentPermission === "default" && !isDismissed) {
      const timer = setTimeout(() => {
        setShow(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === "granted") {
        debug.log("Notification permission granted");
        new Notification("Notifications Enabled", {
          body: "You will now receive real-time notifications from Bluesky",
          icon: "/favicon.ico",
        });
      }

      setShow(false);
    } catch (error) {
      debug.error("Error requesting notification permission:", error);
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("notification-permission-dismissed", "true");
  };

  if (!show || permission !== "default") {
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
      >
        <div className="flex items-start gap-3">
          <div
            className="rounded-full p-2"
            style={{
              background: "var(--bsky-primary)",
              color: "white",
            }}
          >
            <Bell className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <h3
              className="mb-1 font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Enable Notifications
            </h3>
            <p
              className="mb-3 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Get real-time notifications for likes, replies, and mentions
            </p>

            <div className="flex gap-2">
              <button
                onClick={requestPermission}
                className="flex-1 rounded px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
                style={{
                  background: "var(--bsky-primary)",
                  color: "white",
                }}
              >
                Enable
              </button>
              <button
                onClick={dismiss}
                className="rounded px-3 py-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{
                  background: "var(--bsky-bg-tertiary)",
                  color: "var(--bsky-text-secondary)",
                }}
              >
                Not Now
              </button>
            </div>
          </div>

          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
