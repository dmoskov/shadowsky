import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  Loader,
  RefreshCw,
  User,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  AccountManager,
  type StoredAccount,
} from "../../services/account-manager";
import { proxifyBskyImage } from "../../utils/image-proxy";

export interface AccountPostStatus {
  did: string;
  status: "pending" | "posting" | "success" | "error";
  error?: string;
  postUrl?: string;
}

interface MultiAccountSelectorProps {
  selectedAccounts: string[];
  onSelectionChange: (dids: string[]) => void;
  disabled?: boolean;
  postStatuses?: AccountPostStatus[];
  onRetry?: (did: string) => void;
  currentAccountDid?: string;
}

export const MultiAccountSelector: React.FC<MultiAccountSelectorProps> = ({
  selectedAccounts,
  onSelectionChange,
  disabled = false,
  postStatuses,
  onRetry,
  currentAccountDid,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const loadedAccounts = AccountManager.getAllAccounts();
    setAccounts(loadedAccounts);

    // If no accounts are selected and we have accounts, select the current account by default
    if (
      selectedAccounts.length === 0 &&
      loadedAccounts.length > 0 &&
      currentAccountDid
    ) {
      onSelectionChange([currentAccountDid]);
    }
  }, [currentAccountDid, onSelectionChange, selectedAccounts.length]);

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

  const toggleAccount = useCallback(
    (did: string) => {
      if (selectedAccounts.includes(did)) {
        // Don't allow deselecting the last account
        if (selectedAccounts.length > 1) {
          onSelectionChange(selectedAccounts.filter((d) => d !== did));
        }
      } else {
        onSelectionChange([...selectedAccounts, did]);
      }
    },
    [selectedAccounts, onSelectionChange],
  );

  const selectAll = useCallback(() => {
    onSelectionChange(accounts.map((acc) => acc.did));
  }, [accounts, onSelectionChange]);

  const getStatusIcon = (did: string) => {
    const status = postStatuses?.find((s) => s.did === did);
    if (!status) return null;

    switch (status.status) {
      case "posting":
        return <Loader size={14} className="animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle size={14} className="text-green-500" />;
      case "error":
        return (
          <div className="flex items-center gap-1">
            <AlertCircle size={14} className="text-red-500" />
            {onRetry && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(did);
                }}
                title={`Retry: ${status.error || "Unknown error"}`}
              >
                <RefreshCw
                  size={12}
                  className="touch-target rounded p-0.5 text-red-500 hover:bg-gray-200/50 dark:hover:bg-white/10"
                />
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const selectedAccountsData = accounts.filter((acc) =>
    selectedAccounts.includes(acc.did),
  );

  // Don't render if there's only one account
  if (accounts.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          if (!disabled && !isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
              top: rect.bottom + 8,
              left: rect.left,
            });
          }
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        disabled={disabled}
        className="touch-target flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:bg-gray-200/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
          color: "var(--asph-text-primary)",
        }}
      >
        <div className="flex -space-x-2">
          {selectedAccountsData.slice(0, 3).map((account) => (
            <div key={account.did} className="relative">
              {account.avatar ? (
                <img
                  src={proxifyBskyImage(account.avatar)}
                  alt={account.handle}
                  className="h-6 w-6 rounded-full border-2"
                  style={{ borderColor: "var(--asph-bg-secondary)" }}
                />
              ) : (
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderColor: "var(--asph-bg-secondary)",
                  }}
                >
                  <User size={12} />
                </div>
              )}
            </div>
          ))}
          {selectedAccountsData.length > 3 && (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium"
              style={{
                backgroundColor: "var(--asph-bg-tertiary)",
                borderColor: "var(--asph-bg-secondary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              +{selectedAccountsData.length - 3}
            </div>
          )}
        </div>
        <span className="text-sm">
          {selectedAccounts.length === 1
            ? selectedAccountsData[0]?.displayName ||
              selectedAccountsData[0]?.handle ||
              "1 account"
            : `${selectedAccounts.length} accounts`}
        </span>
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
            className="asph-glass fixed z-[9999] w-72 overflow-hidden rounded-lg shadow-lg"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border-primary)",
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: "1px solid var(--asph-border-primary)" }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                Post to accounts
              </span>
              <button
                onClick={selectAll}
                className="touch-target-sm text-xs hover:underline"
                style={{ color: "var(--asph-primary)" }}
              >
                Select all
              </button>
            </div>

            <div className="asph-scrollbar max-h-80 overflow-y-auto">
              {accounts.map((account) => {
                const isSelected = selectedAccounts.includes(account.did);
                const isCurrent = account.did === currentAccountDid;
                return (
                  <button
                    key={account.did}
                    onClick={() => toggleAccount(account.did)}
                    className="touch-target-list-item flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(var(--asph-primary-rgb), 0.1)"
                        : "transparent",
                    }}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected ? "border-transparent" : ""
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? "var(--asph-primary)"
                          : "transparent",
                        borderColor: isSelected
                          ? "var(--asph-primary)"
                          : "var(--asph-border-primary)",
                      }}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
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
                      <div className="flex items-center gap-2">
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--asph-text-primary)" }}
                        >
                          {account.displayName || account.handle}
                        </p>
                        {isCurrent && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: "var(--asph-bg-tertiary)",
                              color: "var(--asph-text-secondary)",
                            }}
                          >
                            Current
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        @{account.handle}
                      </p>
                    </div>
                    {getStatusIcon(account.did)}
                  </button>
                );
              })}
            </div>

            {postStatuses &&
              postStatuses.some((s) => s.status !== "pending") && (
                <div
                  className="px-3 py-2"
                  style={{ borderTop: "1px solid var(--asph-border-primary)" }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--asph-text-tertiary)" }}>
                      {
                        postStatuses.filter((s) => s.status === "success")
                          .length
                      }
                      /{postStatuses.length} posted
                    </span>
                    {postStatuses.some((s) => s.status === "error") && (
                      <span className="text-red-500">
                        {
                          postStatuses.filter((s) => s.status === "error")
                            .length
                        }{" "}
                        failed
                      </span>
                    )}
                  </div>
                </div>
              )}
          </div>,
          document.body,
        )}
    </div>
  );
};
