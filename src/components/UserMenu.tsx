import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const menuItems = [
    {
      icon: User,
      label: "Profile",
      onClick: () => handleNavigation(`/profile/${session?.handle}`),
    },
    {
      icon: Settings,
      label: "Settings",
      onClick: () => handleNavigation("/settings"),
    },
    {
      divider: true,
    },
    {
      icon: LogOut,
      label: "Sign Out",
      onClick: handleLogout,
      className: "text-red-500 hover:bg-red-50",
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:bg-white hover:bg-opacity-10"
        style={{ color: "var(--bsky-text-primary)" }}
      >
        <span className="text-sm font-medium">
          @{session?.handle || "user"}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="bsky-glass absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg shadow-lg"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div
            className="border-b px-4 py-3"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            <p
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {session?.handle}
            </p>
            <p
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              @{session?.handle}
            </p>
          </div>

          <div className="py-1">
            {menuItems.map((item, index) => {
              if (item.divider) {
                return (
                  <div
                    key={index}
                    className="my-1 border-t"
                    style={{ borderColor: "var(--bsky-border-primary)" }}
                  />
                );
              }

              const Icon = item.icon!;
              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-blue-50 ${
                    item.className || ""
                  }`}
                  style={{
                    color: item.className?.includes("text-red")
                      ? undefined
                      : "var(--bsky-text-primary)",
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
