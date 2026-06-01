import { Menu } from "lucide-react";
import React from "react";
import { AccountSwitcher } from "./AccountSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import appIcon from "/butterfly-icon.svg";

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  return (
    <header
      role="banner"
      aria-label="Site header"
      className="asph-glass fixed left-0 right-0 top-0 z-50 h-16"
      style={{
        borderBottom: "1px solid var(--asph-border-primary)",
      }}
    >
      <div className="flex h-full items-center justify-between px-4 mx-auto 2xl:max-w-[1536px]">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
            className="touch-target-icon rounded-lg p-2 transition-all hover:scale-105 hover:bg-asph-bg-hover lg:hidden"
          >
            <Menu
              size={24}
              style={{ color: "var(--asph-text-primary)" }}
              aria-hidden="true"
            />
          </button>

          <div className="flex items-center gap-2.5">
            <img
              src={appIcon}
              alt="Asphodel Logo"
              className="h-7 w-7 self-center"
            />
            <h1
              className="text-gradient-refined hidden text-xl font-bold sm:block"
              style={{ letterSpacing: "var(--asph-letter-spacing-heading)" }}
            >
              Asphodel
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
