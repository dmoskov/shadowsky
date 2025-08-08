import { LogOut, Menu } from "lucide-react";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import butterflyIcon from "/butterfly-icon.svg";

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { session, logout } = useAuth();

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

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              @{session?.handle || "user"}
            </span>
          </div>
          <ThemeToggle />
          <button
            onClick={logout}
            className="bsky-button-ghost flex items-center gap-1.5 text-sm"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
