import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { X, ArrowRight, Database } from "lucide-react";
import { LOCAL_STORAGE_KEYS } from "../services/storage/storage-constants";

export const ColumnMigrationNotice: React.FC = () => {
  const navigate = useNavigate();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // Check if we've migrated columns and haven't shown the notice yet
    const migrated = localStorage.getItem(LOCAL_STORAGE_KEYS.COLUMNS_MIGRATED);
    const noticeShown = localStorage.getItem(LOCAL_STORAGE_KEYS.COLUMN_MIGRATION_NOTICE_SHOWN);
    
    if (migrated === "true" && !noticeShown) {
      setShowNotice(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMN_MIGRATION_NOTICE_SHOWN, "true");
    setShowNotice(false);
  };

  const handleGoToSettings = () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.COLUMN_MIGRATION_NOTICE_SHOWN, "true");
    setShowNotice(false);
    navigate("/settings/data");
  };

  if (!showNotice) return null;

  return (
    <div
      className="fixed bottom-4 right-4 max-w-md rounded-lg p-4 shadow-lg"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        border: "1px solid var(--bsky-border-primary)",
        zIndex: 1000,
      }}
    >
      <div className="flex items-start gap-3">
        <Database className="h-5 w-5 text-blue-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1" style={{ color: "var(--bsky-text-primary)" }}>
            Column Storage Updated
          </h3>
          <p className="text-sm mb-3" style={{ color: "var(--bsky-text-secondary)" }}>
            Your columns have been migrated to the new storage system. You can now sync them across devices using AT Protocol!
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGoToSettings}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Enable Sync
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" style={{ color: "var(--bsky-text-tertiary)" }} />
        </button>
      </div>
    </div>
  );
};