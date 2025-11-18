import { Check, LogOut, Trash2, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  AccountManager,
  type StoredAccount,
} from "../../services/account-manager";
import { proxifyBskyImage } from "../../utils/image-proxy";

export const AccountsSettings: React.FC = () => {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [removingAccount, setRemovingAccount] = useState<string | null>(null);
  const { session, switchAccount, logout } = useAuth();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    setAccounts(AccountManager.getAllAccounts());
  };

  const handleRemoveAccount = async (did: string) => {
    if (!confirm("Are you sure you want to remove this account?")) {
      return;
    }

    setRemovingAccount(did);

    try {
      const removed = AccountManager.removeAccount(did);
      if (removed) {
        loadAccounts();

        if (did === session?.did) {
          logout();
        }
      }
    } finally {
      setRemovingAccount(null);
    }
  };

  const handleSwitchAccount = async (did: string) => {
    if (did === session?.did) return;

    await switchAccount(did);
  };

  const handleAddAccount = () => {
    window.location.href = "/";
  };

  const handleLogoutAll = () => {
    if (!confirm("Are you sure you want to sign out of all accounts?")) {
      return;
    }

    logout(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Manage Accounts
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Switch between your accounts or add a new one
        </p>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => {
          const isActive = account.did === session?.did;
          const isRemoving = removingAccount === account.did;

          return (
            <div
              key={account.did}
              className="bsky-glass flex items-center gap-4 rounded-lg p-4 transition-all"
              style={{
                border: isActive
                  ? "2px solid var(--bsky-primary)"
                  : "1px solid var(--bsky-border-primary)",
                backgroundColor: isActive
                  ? "rgba(var(--bsky-primary-rgb), 0.05)"
                  : "var(--bsky-bg-secondary)",
              }}
            >
              {account.avatar ? (
                <img
                  src={proxifyBskyImage(account.avatar)}
                  alt={account.handle}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
                >
                  <User
                    size={24}
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                </div>
              )}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className="font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {account.displayName || account.handle}
                  </p>
                  {isActive && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--bsky-primary)",
                        color: "white",
                      }}
                    >
                      <Check size={12} />
                      Active
                    </span>
                  )}
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  @{account.handle}
                </p>
              </div>

              <div className="flex gap-2">
                {!isActive && (
                  <button
                    onClick={() => handleSwitchAccount(account.did)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-opacity-90"
                    style={{
                      backgroundColor: "var(--bsky-primary)",
                      color: "white",
                    }}
                  >
                    Switch
                  </button>
                )}

                <button
                  onClick={() => handleRemoveAccount(account.did)}
                  disabled={isRemoving}
                  className="rounded-lg p-2 transition-colors hover:bg-red-50 hover:bg-opacity-10 disabled:opacity-50"
                  style={{ color: "var(--bsky-text-secondary)" }}
                  title="Remove account"
                >
                  {isRemoving ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                  ) : (
                    <Trash2 size={20} className="text-red-500" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={handleAddAccount}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--bsky-primary)",
            color: "white",
          }}
        >
          <User size={16} />
          Add Another Account
        </button>

        {accounts.length > 0 && (
          <button
            onClick={handleLogoutAll}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:bg-opacity-10"
            style={{
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <LogOut size={16} />
            Sign Out of All Accounts
          </button>
        )}
      </div>

      <div
        className="rounded-lg p-4 text-sm"
        style={{
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          color: "var(--bsky-text-secondary)",
        }}
      >
        <p
          className="font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          About Multi-Account Support
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• Switch between accounts without re-entering credentials</li>
          <li>
            • Each account maintains separate drafts, bookmarks, and settings
          </li>
          <li>• Your credentials are stored securely in your browser</li>
        </ul>
      </div>
    </div>
  );
};
