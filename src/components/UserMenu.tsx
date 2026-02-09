import {
  ChevronDown,
  LogIn,
  LogOut,
  Settings,
  User,
  Users,
} from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useMenuKeyboardNavigation } from "../hooks/useMenuKeyboardNavigation";
import { AccountManager } from "../services/account-manager";

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  // Keyboard navigation for menu
  useMenuKeyboardNavigation({
    isOpen,
    onClose: () => setIsOpen(false),
    menuRef,
    triggerRef: buttonRef,
  });

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

  const hasMultipleAccounts = AccountManager.hasMultipleAccounts();

  const handleAddAccount = () => {
    navigate("/add-account");
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
    ...(hasMultipleAccounts
      ? [
          {
            icon: Users,
            label: "Manage Accounts",
            onClick: () => handleNavigation("/settings/accounts"),
          },
        ]
      : []),
    {
      icon: LogIn,
      label: "Sign into another account",
      onClick: handleAddAccount,
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
        ref={buttonRef}
        onClick={() => {
          if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
              top: rect.bottom + 8,
              right: window.innerWidth - rect.right,
            });
          }
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:bg-white hover:bg-opacity-10"
        style={{ color: "var(--bsky-text-primary)" }}
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <span className="max-w-[150px] truncate text-sm font-medium">
          @{session?.handle || "user"}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        menuPosition &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="User menu"
            className="bsky-glass fixed z-[9999] w-56 overflow-hidden rounded-lg shadow-lg"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              border: "1px solid var(--bsky-border-primary)",
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
          >
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: "var(--bsky-border-primary)" }}
            >
              <p
                className="truncate font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {session?.handle}
              </p>
              <p
                className="truncate text-sm"
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
                      key={`menu-divider-${index}`}
                      role="separator"
                      className="my-1 border-t"
                      style={{ borderColor: "var(--bsky-border-primary)" }}
                    />
                  );
                }

                const Icon = item.icon!;
                return (
                  <button
                    key={`menu-item-${item.label}-${index}`}
                    role="menuitem"
                    onClick={item.onClick}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-blue-900/20 dark:focus-visible:bg-blue-900/20 ${
                      item.className || ""
                    }`}
                    style={{
                      color: item.className?.includes("text-red")
                        ? undefined
                        : "var(--bsky-text-primary)",
                    }}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
