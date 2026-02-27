import { Bell, Home, Mail, Search, User } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadNotificationCount } from "../hooks/useNotifications";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";

/**
 * Scroll all visible scroll containers to the top.
 * Handles: window scroll, main content area, SkyColumn .asph-scrollbar containers,
 * and dispatches a custom event for specialized containers (react-window lists, etc.).
 */
function scrollPageToTop() {
  // 1. Scroll the window (handles route-based views on mobile)
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // 2. Scroll the main content area (desktop scroll container)
  const mainElement = document.getElementById("main-content");
  if (mainElement && mainElement.scrollTop > 0) {
    mainElement.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 3. Scroll any SkyColumn scroll containers
  document.querySelectorAll(".asph-scrollbar").forEach((el) => {
    if ((el as HTMLElement).scrollTop > 0) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // 4. Dispatch event for specialized scroll containers (react-window, etc.)
  window.dispatchEvent(new CustomEvent("tabScrollToTop"));
}

export const MobileTabBar: React.FC = () => {
  const { session } = useAuth();
  const { data: unreadCount } = useUnreadNotificationCount();
  const location = useLocation();
  const navigate = useNavigate();
  const lastTapRef = useRef<number>(0);
  const [bouncingTab, setBouncingTab] = useState<string | null>(null);
  const { getRoutePrefetchHandlers, getProfilePrefetchHandlers } =
    useRoutePrefetch();

  const tabs = [
    { path: "/", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/notifications", label: "Notifs", icon: Bell },
    { path: "/messages", label: "DMs", icon: Mail },
    {
      path: `/profile/${session?.handle || ""}`,
      label: "Profile",
      icon: User,
      profileHandle: session?.handle,
    },
  ];

  const triggerBounce = useCallback((path: string) => {
    setBouncingTab(path);
    setTimeout(() => setBouncingTab(null), 400);
  }, []);

  // Check if a tab is currently active
  const isTabActive = useCallback(
    (tabPath: string) => {
      if (tabPath === "/") {
        return location.pathname === "/" || location.pathname === "/home";
      }
      return location.pathname === tabPath;
    },
    [location.pathname],
  );

  const handleTabClick = useCallback(
    (e: React.MouseEvent, tabPath: string) => {
      e.preventDefault();
      triggerBounce(tabPath);

      if (isTabActive(tabPath)) {
        // Already on this tab — scroll to top
        scrollPageToTop();

        // Home tab: double-tap refreshes the feed
        if (tabPath === "/") {
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            window.dispatchEvent(new CustomEvent("refreshFeed"));
          }
          lastTapRef.current = now;
        }
      } else {
        // Navigate to the tab
        navigate(tabPath);
      }
    },
    [isTabActive, triggerBounce, navigate],
  );

  return (
    <nav
      aria-label="Mobile navigation"
      className="asph-glass fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        borderTop: "1px solid var(--asph-border-primary)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = isTabActive(tab.path);
          const isBouncing = bouncingTab === tab.path;

          // Prefetch handlers for non-active tabs
          const prefetchHandlers = !isActive
            ? "profileHandle" in tab && tab.profileHandle
              ? getProfilePrefetchHandlers(tab.profileHandle)
              : getRoutePrefetchHandlers(tab.path)
            : {};

          return (
            <button
              key={tab.path}
              onClick={(e) => handleTabClick(e, tab.path)}
              aria-label={`${tab.label}${isActive ? " (current)" : ""}`}
              aria-current={isActive ? "page" : undefined}
              className={`touch-target relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-all ${
                isActive ? "scale-105" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                color: isActive
                  ? "var(--asph-primary)"
                  : "var(--asph-text-secondary)",
              }}
              {...prefetchHandlers}
            >
              <div
                className={`relative ${isBouncing ? "animate-tab-icon-bounce" : ""}`}
              >
                {React.createElement(tab.icon, {
                  size: 20,
                  "aria-hidden": true,
                })}
                {tab.path === "/notifications" &&
                  unreadCount !== undefined &&
                  unreadCount !== null &&
                  unreadCount > 0 && (
                    <span
                      className="animate-badge-in animate-badge-pulse absolute -right-1 -top-1 h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: "var(--asph-accent)",
                      }}
                      aria-label={`${unreadCount} unread notifications`}
                    />
                  )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
