import { HardDrive, Trash2 } from "lucide-react";
import React, { useState } from "react";

export const DataSettings: React.FC = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleClearCache = () => {
    if (
      confirm(
        "Are you sure you want to clear all cached data? This will log you out.",
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Data & Storage
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Manage your data and storage preferences
        </p>
      </div>

      <div className="space-y-4">
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive
                size={20}
                style={{ color: "var(--bsky-text-secondary)" }}
              />
              <div>
                <div
                  className="font-medium"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  Cached Data
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Includes posts, images, and user data
                </div>
              </div>
            </div>
            <button
              onClick={handleClearCache}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                color: "var(--bsky-text-primary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              <Trash2 size={16} />
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
