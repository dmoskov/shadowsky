import { Check, ChevronDown, Plus, User } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import {
  AccountManager,
  type StoredAccount,
} from "../services/account-manager";
import { proxifyBskyImage } from "../utils/image-proxy";

export const AccountSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { session, switchAccount } = useAuth();
  const navigate = useViewTransitionNavigate();

  useEffect(() => {
    if (isOpen) {
      setAccounts(AccountManager.getAllAccounts());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
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

  const handleSwitchAccount = async (did: string) => {
    if (did === session?.did) {
      setIsOpen(false);
      return;
    }

    await switchAccount(did);
    setIsOpen(false);
  };

  const handleAddAccount = () => {
    setIsOpen(false);
    navigate("/add-account");
  };

  const currentAccount = accounts.find((acc) => acc.did === session?.did);

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className="relative">
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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all hover:bg-asph-bg-hover"
        style={{ color: "var(--asph-text-primary)" }}
      >
        {currentAccount?.avatar ? (
          <img
            src={proxifyBskyImage(currentAccount.avatar)}
            alt={currentAccount.handle}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          >
            <User size={14} />
          </div>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        menuPosition &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="dropdown-refined animate-dropdown-in fixed z-[9999] w-64"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
          >
            <div
              className="px-3 py-2.5 text-xs font-medium"
              style={{
                color: "var(--asph-text-tertiary)",
                letterSpacing: "var(--asph-letter-spacing-wide)",
              }}
            >
              Switch Account
            </div>

            <div className="asph-scrollbar max-h-80 overflow-y-auto">
              {accounts.map((account) => {
                const isActive = account.did === session?.did;
                return (
                  <button
                    key={account.did}
                    onClick={() => handleSwitchAccount(account.did)}
                    className="ios-press-light flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-asph-bg-hover"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(var(--asph-primary-rgb), 0.1)"
                        : "transparent",
                    }}
                  >
                    {account.avatar ? (
                      <img
                        src={proxifyBskyImage(account.avatar)}
                        alt={account.handle}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                      >
                        <User size={20} />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {account.displayName || account.handle}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        @{account.handle}
                      </p>
                    </div>
                    {isActive && (
                      <Check
                        size={18}
                        style={{ color: "var(--asph-primary)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="divider-refined">
              <button
                onClick={handleAddAccount}
                className="flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-asph-bg-hover"
                style={{ color: "var(--asph-text-primary)" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                >
                  <Plus size={20} />
                </div>
                <span className="text-sm font-medium">
                  Sign into another account
                </span>
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
