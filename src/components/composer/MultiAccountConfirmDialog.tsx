import { AlertTriangle, CheckCircle, User, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  AccountManager,
  type StoredAccount,
} from "../../services/account-manager";
import { proxifyBskyImage } from "../../utils/image-proxy";

interface MultiAccountConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedAccountDids: string[];
  postCount: number;
  hasMedia: boolean;
}

export const MultiAccountConfirmDialog: React.FC<
  MultiAccountConfirmDialogProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedAccountDids,
  postCount,
  hasMedia,
}) => {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const allAccounts = AccountManager.getAllAccounts();
      setAccounts(
        allAccounts.filter((acc) => selectedAccountDids.includes(acc.did)),
      );
    }
  }, [isOpen, selectedAccountDids]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Save preference if checked
    if (dontShowAgain) {
      localStorage.setItem("shadowsky_skip_multi_account_confirm", "true");
    }
    onConfirm();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="asph-card relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl p-0"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--asph-border-primary)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: "var(--asph-warning)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Confirm Multi-Account Post
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-white hover:bg-opacity-10"
          >
            <X size={20} style={{ color: "var(--asph-text-secondary)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            You are about to post{" "}
            {postCount > 1 ? `a ${postCount}-post thread` : "a post"}
            {hasMedia ? " with media" : ""} to the following {accounts.length}{" "}
            account
            {accounts.length > 1 ? "s" : ""}:
          </p>

          <div
            className="mb-4 max-h-48 overflow-y-auto rounded-lg p-2"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          >
            {accounts.map((account) => (
              <div
                key={account.did}
                className="flex items-center gap-3 rounded-lg p-2"
              >
                <CheckCircle
                  size={16}
                  className="flex-shrink-0 text-green-500"
                />
                {account.avatar ? (
                  <img
                    src={proxifyBskyImage(account.avatar)}
                    alt={account.handle}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--asph-bg-secondary)" }}
                  >
                    <User size={16} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {account.displayName || account.handle}
                  </p>
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    @{account.handle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Don't show again checkbox */}
          <label className="mb-4 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--asph-primary)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Don't show this confirmation again
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--asph-bg-tertiary)",
                color: "var(--asph-text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "var(--asph-primary)" }}
            >
              Post to {accounts.length} Account{accounts.length > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
