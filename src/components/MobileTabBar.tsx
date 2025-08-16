import { Bell, Home, Mail, Search, User } from "lucide-react";
import React, { useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadNotificationCount } from "../hooks/useNotifications";

export const MobileTabBar: React.FC = () => {
  const { session } = useAuth();
  const { data: unreadCount } = useUnreadNotificationCount();
  const location = useLocation();
  const navigate = useNavigate();
  const lastTapRef = useRef<number>(0);

  const tabs = [
    { path: "/", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/notifications", label: "Notifs", icon: Bell },
    { path: "/messages", label: "DMs", icon: Mail },
    { path: `/profile/${session?.handle || ""}`, label: "Profile", icon: User },
  ];

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (location.pathname === "/") {
      // We're already on the home page
      if (timeSinceLastTap < 300) {
        // Double tap - refresh the feed
        window.dispatchEvent(new CustomEvent("refreshFeed"));
      } else {
        // Single tap - scroll to top
        // Try multiple scroll methods to ensure it works
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // Also try to find the main scrollable container
        const mainElement = document.querySelector("main");
        if (mainElement) {
          mainElement.scrollTop = 0;
        }

        // Try to find the feed container specifically
        const feedContainer =
          document.querySelector(".bsky-scrollbar") ||
          document.querySelector('[role="feed"]')?.closest(".overflow-y-auto");
        if (feedContainer) {
          feedContainer.scrollTop = 0;
        }
      }
    } else {
      // Not on home page - navigate to home
      navigate("/");
    }

    lastTapRef.current = now;
  };

  return (
    <nav
      className="bsky-glass fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        borderTop: "1px solid var(--bsky-border-primary)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-12 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;

          if (tab.path === "/") {
            // Special handling for Home tab
            return (
              <button
                key={tab.path}
                onClick={handleHomeClick}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all ${
                  isActive ? "scale-105" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  color: isActive
                    ? "var(--bsky-primary)"
                    : "var(--bsky-text-secondary)",
                }}
              >
                <div className="relative">
                  {React.createElement(tab.icon, { size: 24 })}
                </div>
              </button>
            );
          }

          // Regular NavLink for other tabs
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all ${
                  isActive ? "scale-105" : "opacity-70 hover:opacity-100"
                }`
              }
              style={({ isActive }) => ({
                color: isActive
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
              })}
            >
              <div className="relative">
                {React.createElement(tab.icon, { size: 24 })}
                {tab.path === "/notifications" &&
                  unreadCount !== undefined &&
                  unreadCount !== null &&
                  unreadCount > 0 && (
                    <span
                      className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: "var(--bsky-accent)",
                      }}
                    />
                  )}
              </div>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
