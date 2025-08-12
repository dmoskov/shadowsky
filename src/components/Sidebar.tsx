import {
  BarChart3,
  Bell,
  Bookmark,
  Clock,
  ExternalLink,
  Home,
  MessageSquare,
  PenSquare,
  Search,
  User,
  X,
} from "lucide-react";
import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { session } = useAuth();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/search", label: "Search", icon: Search, hideOnMobile: true },
    {
      path: "/notifications",
      label: "Notifications",
      icon: Bell,
      hideOnMobile: true,
    },
    { path: "/timeline", label: "Timeline", icon: Clock },
    { path: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { path: "/conversations", label: "Conversations", icon: MessageSquare },
    { path: "/compose", label: "Compose", icon: PenSquare },
    {
      path: `/profile/${session?.handle || ""}`,
      label: "Profile",
      icon: User,
      hideOnMobile: true,
    },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bsky-glass fixed bottom-0 left-0 top-16 z-40 w-64 max-w-[80vw] transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ borderRight: "1px solid var(--bsky-border-primary)" }}
      >
        <div className="flex items-center justify-between p-4 lg:hidden">
          <h2 className="bsky-gradient-text text-lg font-bold">Menu</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-all hover:opacity-70"
          >
            <X size={20} style={{ color: "var(--bsky-text-secondary)" }} />
          </button>
        </div>

        <nav className="space-y-1 px-4 pt-4">
          {navItems.map((item) => {
            // Hide certain items on mobile since they're in the tab bar
            const shouldHide = item.hideOnMobile && window.innerWidth < 1024;
            if (shouldHide) return null;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                    isActive ? "text-white shadow-md" : "hover:bg-blue-50"
                  } `
                }
                style={({ isActive }) => ({
                  color: isActive ? "white" : "var(--bsky-text-secondary)",
                  backgroundColor: isActive
                    ? "var(--bsky-primary)"
                    : "transparent",
                })}
              >
                <item.icon
                  size={20}
                  className="transition-transform group-hover:scale-110"
                />
                <span className="font-medium transition-colors">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div
          className="mx-4 my-4 border-t"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        ></div>

        {/* External Links */}
        <div className="space-y-1 px-4">
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 hover:bg-blue-500 hover:bg-opacity-10"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            <ExternalLink
              size={20}
              className="transition-transform group-hover:scale-110"
            />
            <span className="font-medium transition-colors">Open Bluesky</span>
          </a>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 border-t p-4"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <div
            className="text-center text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            <div className="bsky-gradient-text mb-1 font-bold">ShadowSky</div>
            <div>Version 0.4.0</div>
          </div>
        </div>
      </aside>
    </>
  );
};
