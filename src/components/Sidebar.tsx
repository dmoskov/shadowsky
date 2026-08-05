import { Compass, ExternalLink } from "lucide-react";
import React from "react";
import { NavLink } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadNotificationCount } from "../hooks/useNotifications";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import {
  BellIcon,
  BookmarkIcon,
  CloseIcon,
  HomeIcon,
  ListIcon,
  MailboxIcon,
  PersonIcon,
  SearchIcon,
} from "./icons";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
}) => {
  const { session } = useAuth();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { getRoutePrefetchHandlers, getProfilePrefetchHandlers } =
    useRoutePrefetch();

  // Primary navigation only. Deliberately excluded, each reachable elsewhere:
  //   Compose   -> floating action button and the command palette ("C")
  //   Timeline  -> a deck column type, and the command palette
  //   Analytics -> your own profile page, and the command palette
  const navItems = [
    { path: "/", label: "Home", icon: HomeIcon },
    { path: "/search", label: "Search", icon: SearchIcon },
    { path: "/discover", label: "Discover", icon: Compass },
    {
      path: "/notifications",
      label: "Notifications",
      icon: BellIcon,
    },
    { path: "/messages", label: "Direct Messages", icon: MailboxIcon },
    { path: "/bookmarks", label: "Bookmarks", icon: BookmarkIcon },
    { path: "/lists", label: "Lists", icon: ListIcon },
    {
      path: `/profile/${session?.handle || ""}`,
      label: "Profile",
      icon: PersonIcon,
      profileHandle: session?.handle,
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.4)",
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="main-navigation"
        role="navigation"
        aria-label="Main navigation"
        className={`asph-glass fixed bottom-0 top-16 z-40 overflow-y-auto lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] ${isCollapsed ? "w-16" : "w-64"} max-w-[80vw] transform transition-all duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{
          borderRight: "1px solid var(--asph-border-primary)",
          left: isOpen ? "0" : undefined,
        }}
      >
        <div className="flex items-center justify-between p-4 lg:hidden">
          <h2 className="asph-gradient-text text-lg font-bold">Menu</h2>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="touch-target-icon flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-all hover:opacity-70"
          >
            <CloseIcon
              size={20}
              style={{ color: "var(--asph-text-secondary)" }}
              aria-hidden="true"
            />
          </button>
        </div>

        <nav className={`space-y-1 ${isCollapsed ? "px-2" : "px-4"} pt-4`}>
          {navItems.map((item) => {
            // Get prefetch handlers based on item type
            // Profile links get profile-specific prefetching
            // Other links get route chunk prefetching
            const prefetchHandlers =
              "profileHandle" in item && item.profileHandle
                ? getProfilePrefetchHandlers(item.profileHandle)
                : getRoutePrefetchHandlers(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                viewTransition
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `group relative flex min-h-[44px] items-center ${isCollapsed ? "justify-center" : "gap-3"} rounded-xl ${isCollapsed ? "px-2" : "px-3"} ios-press-light py-2.5 transition-all duration-200 ${
                    isActive ? "text-white" : "hover:bg-asph-bg-hover"
                  } `
                }
                style={({ isActive }) => ({
                  color: isActive ? "white" : "var(--asph-text-secondary)",
                  backgroundColor: isActive
                    ? "var(--asph-primary)"
                    : "transparent",
                  boxShadow: isActive
                    ? "var(--asph-shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                    : "none",
                })}
                title={isCollapsed ? item.label : undefined}
                {...prefetchHandlers}
              >
                <div className="relative">
                  <item.icon
                    size={20}
                    className={`transition-transform group-hover:scale-110 ${isCollapsed ? "mx-0" : ""}`}
                  />
                  {item.path === "/notifications" &&
                    unreadCount !== undefined &&
                    unreadCount > 0 && (
                      <span
                        className="animate-badge-in absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: "var(--asph-accent)",
                          boxShadow: "0 0 0 2px var(--asph-bg-primary)",
                        }}
                      />
                    )}
                </div>
                {!isCollapsed && (
                  <span
                    className="font-medium transition-colors"
                    style={{
                      letterSpacing: "var(--asph-letter-spacing-tight)",
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="divider-refined mx-4 my-4"></div>

        {/* External Links */}
        <div className={`space-y-1 ${isCollapsed ? "px-2" : "px-4"}`}>
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex min-h-[44px] items-center ${isCollapsed ? "justify-center" : "gap-3"} rounded-xl ${isCollapsed ? "px-2" : "px-3"} py-2.5 transition-all duration-200 hover:bg-asph-bg-hover`}
            style={{ color: "var(--asph-text-secondary)" }}
            title={isCollapsed ? "Open Bluesky" : undefined}
          >
            <ExternalLink
              size={20}
              className={`transition-transform group-hover:scale-110 ${isCollapsed ? "mx-0" : ""}`}
            />
            {!isCollapsed && (
              <span className="font-medium transition-colors">
                Open Bluesky
              </span>
            )}
          </a>
        </div>

        {!isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="divider-refined mb-4"></div>
            <div
              className="text-center text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              <div className="text-gradient-refined mb-1 font-bold">
                Asphodel
              </div>
              <div style={{ letterSpacing: "var(--asph-letter-spacing-wide)" }}>
                Version 0.8.1
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
