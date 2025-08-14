import { Bell, Menu } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { useUnreadNotificationCount } from "../hooks/useNotifications";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import butterflyIcon from "/butterfly-icon.svg";

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <header
      className="bsky-glass fixed left-0 right-0 top-0 z-50 h-16"
      style={{ borderBottom: "1px solid var(--bsky-border-primary)" }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 transition-all hover:bg-white hover:bg-opacity-10 lg:hidden"
          >
            <Menu size={24} style={{ color: "var(--bsky-text-primary)" }} />
          </button>

          <div className="flex items-center gap-2">
            <img
              src={butterflyIcon}
              alt="ShadowSky Logo"
              className="h-7 w-7"
              style={{ marginTop: "2px" }}
            />
            <h1 className="bsky-gradient-text hidden text-xl font-bold sm:block">
              ShadowSky
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative rounded-lg p-2 transition-all hover:bg-white hover:bg-opacity-10"
          >
            <Bell size={20} style={{ color: "var(--bsky-text-primary)" }} />
            {unreadCount !== undefined && unreadCount > 0 && (
              <span
                className="absolute right-1 top-1 h-2 w-2 rounded-full"
                style={{
                  backgroundColor: "var(--bsky-accent)",
                }}
              />
            )}
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
